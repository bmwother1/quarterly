import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { Assignment, Availability, WorkKind } from '../src/lib/types.ts';
import { assignmentsFromICS } from '../src/lib/canvas/interpret.ts';
import { defaultAvailability, freeSlots, mergeIntervals, subtract } from '../src/lib/schedule/slots.ts';
import { planWeek, dueInstant } from '../src/lib/schedule/plan.ts';
import { urgency, fitAt, energyAt, spacingFactor, confidenceFactor, methodFor } from '../src/lib/schedule/score.ts';
import { localParts, zonedInstant, addDays } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
const midquarter = readFileSync(new URL('../fixtures/sample-feed-midquarter.ics', import.meta.url), 'utf8');

/** A Monday, 8am Pacific. Synthetic cases below are relative to this so tests never drift. */
const MONDAY_8AM = zonedInstant('2026-10-05', 8 * 60, TZ);

/**
 * The fixture quarter runs Jul 30 → Oct 7 2026, so tests that feed it real
 * Canvas data anchor here instead — a Monday with 41 deadlines still ahead of
 * it. Anchoring those to MONDAY_8AM would leave almost nothing upcoming, and
 * every assertion about scheduling would pass vacuously on an empty plan.
 */
const FIXTURE_MONDAY = zonedInstant('2026-08-24', 8 * 60, TZ);
const FIXTURE = assignmentsFromICS(midquarter);

function fixtureWork(limit?: number): Assignment[] {
  const upcoming = FIXTURE.filter((a) => new Date(a.due) > FIXTURE_MONDAY);
  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

function makeAssignment(over: Partial<Assignment> & { kind: WorkKind; due: string }): Assignment {
  return {
    id: over.id ?? `a-${Math.random().toString(36).slice(2)}`,
    title: over.title ?? 'Test item',
    course: over.course ?? 'TEST 101',
    courseFull: over.courseFull ?? 'TEST 101 A',
    kind: over.kind,
    due: over.due,
    allDay: over.allDay ?? false,
    url: null,
    estimatedMinutes: over.estimatedMinutes ?? 100,
    actualMinutes: over.actualMinutes ?? 0,
    status: over.status ?? 'todo',
    weight: over.weight ?? 0.1,
    confidence: over.confidence ?? 0.5,
    lastTouched: over.lastTouched ?? null,
  };
}

/** Availability with nothing but sleep blocked out — a wide-open week. */
function openWeek(over: Partial<Availability> = {}): Availability {
  return { ...defaultAvailability(), ...over };
}

describe('interval maths', () => {
  test('merges overlapping and touching intervals', () => {
    assert.deepEqual(
      mergeIntervals([{ start: 100, end: 200 }, { start: 180, end: 260 }, { start: 400, end: 500 }]),
      [{ start: 100, end: 260 }, { start: 400, end: 500 }],
    );
  });

  test('subtracting nothing returns the whole window', () => {
    assert.deepEqual(subtract(480, 1320, []), [{ start: 480, end: 1320 }]);
  });

  test('subtracting a middle block splits the window', () => {
    assert.deepEqual(
      subtract(480, 1320, [{ start: 600, end: 700 }]),
      [{ start: 480, end: 600 }, { start: 700, end: 1320 }],
    );
  });

  test('a block covering the window leaves nothing', () => {
    assert.deepEqual(subtract(480, 1320, [{ start: 0, end: 1440 }]), []);
  });
});

describe('free slots', () => {
  test('an open week yields one usable slot per day', () => {
    const slots = freeSlots(openWeek(), MONDAY_8AM, 7, TZ);
    const days = new Set(slots.map((s) => s.dateKey));
    assert.equal(days.size, 7);
    assert.ok(slots.every((s) => s.minutes >= 25));
  });

  test('classes are carved out of the day', () => {
    const av = openWeek({
      busy: [
        ...defaultAvailability().busy,
        { id: 'c1', day: 0, startMin: 10 * 60, endMin: 11 * 60 + 20, label: 'CHEM 142', kind: 'class' },
      ],
    });
    const monday = freeSlots(av, MONDAY_8AM, 1, TZ);
    assert.equal(monday.length, 2, 'one class in the middle of the day should split it in two');

    const first = monday[0];
    assert.equal(localParts(first.end, TZ).minutesOfDay, 10 * 60);
    assert.equal(localParts(monday[1].start, TZ).minutesOfDay, 11 * 60 + 20);
  });

  test('time already gone today is not offered', () => {
    const noon = zonedInstant('2026-10-05', 12 * 60 + 7, TZ);
    const [slot] = freeSlots(openWeek(), noon, 1, TZ);
    // Rounded up to the next quarter hour so blocks don't start at 12:07.
    assert.equal(localParts(slot.start, TZ).minutesOfDay, 12 * 60 + 15);
  });

  test('a sleep block wrapping past midnight blocks the next morning', () => {
    const av = openWeek({ dayStartMin: 0, dayEndMin: 1440 });
    const [slot] = freeSlots(av, zonedInstant('2026-10-05', 0, TZ), 1, TZ);
    // Sleep is 23:00–07:00, so the first opening on Monday starts at 07:00.
    assert.equal(localParts(slot.start, TZ).minutesOfDay, 7 * 60);
  });

  test('slots survive the DST boundary without drifting', () => {
    // US DST ends Nov 1 2026. Plan across it and check every day still starts at 8am local.
    const slots = freeSlots(openWeek(), zonedInstant('2026-10-29', 8 * 60, TZ), 7, TZ);
    for (const s of slots) {
      assert.equal(localParts(s.start, TZ).minutesOfDay, 8 * 60, `${s.dateKey} should start at 08:00 local`);
    }
  });
});

describe('scoring', () => {
  test('urgency rises as a deadline approaches', () => {
    const far = urgency(10, 'problem set');
    const near = urgency(1, 'problem set');
    const now = urgency(0, 'problem set');
    assert.ok(far < near && near < now);
    assert.equal(urgency(-1, 'problem set'), 6);
  });

  test('exams stay warm further out than small assignments', () => {
    // The bug this prevents: exams never get scheduled early, so the product
    // recreates the cramming it exists to stop.
    assert.ok(urgency(8, 'exam') > urgency(8, 'discussion'));
    assert.ok(urgency(8, 'exam') > urgency(8, 'problem set'));
  });

  test('energy curves respect the declared pattern', () => {
    assert.ok(energyAt(9, 'morning') > energyAt(21, 'morning'));
    assert.ok(energyAt(21, 'evening') > energyAt(9, 'evening'));
  });

  test('demanding work fits the student\'s peak hours', () => {
    assert.ok(fitAt('exam', 9, 'morning') > fitAt('exam', 23, 'morning'));
    assert.ok(fitAt('exam', 21, 'evening') > fitAt('exam', 8, 'evening'));
    // Low-demand work is comparatively indifferent to the hour.
    const spread = (k: WorkKind) => Math.abs(fitAt(k, 9, 'morning') - fitAt(k, 22, 'morning'));
    assert.ok(spread('discussion') < spread('exam'));
  });

  test('neglect and low confidence both raise a score', () => {
    const now = new Date('2026-10-05T12:00:00Z');
    assert.ok(spacingFactor('2026-09-25T12:00:00Z', now) > spacingFactor('2026-10-04T12:00:00Z', now));
    assert.ok(confidenceFactor(0.1) > confidenceFactor(0.9));
    // Bounded — a single shaky item must not swamp everything else.
    assert.ok(confidenceFactor(0) <= 2);
  });

  test('writing shifts from drafting to revising', () => {
    assert.equal(methodFor('writing', 1, 3), 'drafting');
    assert.equal(methodFor('writing', 3, 3), 'revising');
    assert.equal(methodFor('exam', 1, 4), 'retrieval practice');
    assert.equal(methodFor('problem set', 1, 2), 'practice problems');
  });
});

describe('due instants', () => {
  test('an all-day item is due at the end of its day, not the start', () => {
    // Losing this gives away a full day of runway on every all-day deadline.
    const a = makeAssignment({ kind: 'quiz', due: '2026-10-12T12:00:00.000Z', allDay: true });
    const due = dueInstant(a, TZ);
    assert.equal(localParts(due, TZ).dateKey, '2026-10-12');
    assert.equal(localParts(due, TZ).minutesOfDay, 23 * 60 + 59);
  });

  test('a timed item is left alone', () => {
    const a = makeAssignment({ kind: 'quiz', due: '2026-10-13T06:59:00.000Z', allDay: false });
    assert.equal(dueInstant(a, TZ).toISOString(), '2026-10-13T06:59:00.000Z');
  });
});

describe('the planner', () => {
  test('produces blocks for a normal week', () => {
    const assignments = [
      makeAssignment({ kind: 'problem set', course: 'MATH 124', title: 'Homework 3', due: zonedInstant('2026-10-07', 23 * 60 + 59, TZ).toISOString(), estimatedMinutes: 120 }),
      makeAssignment({ kind: 'writing', course: 'ENGL 131', title: 'Essay 1 Draft', due: zonedInstant('2026-10-09', 23 * 60 + 59, TZ).toISOString(), estimatedMinutes: 180 }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });

    assert.ok(result.blocks.length > 0);
    assert.equal(result.unscheduled.length, 0);
    assert.ok(result.stats.scheduledMinutes >= 250, `only scheduled ${result.stats.scheduledMinutes} of 300 minutes`);
  });

  test('never schedules work after its deadline', () => {
    const assignments = fixtureWork(25);
    const result = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });

    for (const b of result.blocks) {
      const a = assignments.find((x) => x.id === b.assignmentId)!;
      const due = dueInstant(a, TZ);
      if (new Date(a.due) < MONDAY_8AM) continue;   // overdue work gets an artificial runway
      assert.ok(new Date(b.end) <= due, `"${b.title}" scheduled past its ${due.toISOString()} deadline`);
    }
  });

  test('never schedules during a declared busy block', () => {
    const av = openWeek({
      busy: [
        ...defaultAvailability().busy,
        { id: 'c1', day: 0, startMin: 9 * 60, endMin: 17 * 60, label: 'Work shift', kind: 'work' },
      ],
    });
    const assignments = fixtureWork(15);
    const result = planWeek(assignments, av, { now: FIXTURE_MONDAY, tz: TZ });

    for (const b of result.blocks) {
      const p = localParts(new Date(b.start), TZ);
      const pEnd = localParts(new Date(b.end), TZ);
      if (p.weekday !== 0) continue;
      assert.ok(
        pEnd.minutesOfDay <= 9 * 60 || p.minutesOfDay >= 17 * 60,
        `"${b.title}" at ${p.minutesOfDay} collides with the Monday work shift`,
      );
    }
  });

  test('blocks never overlap each other', () => {
    const assignments = fixtureWork(30);
    const result = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });

    for (let i = 1; i < result.blocks.length; i++) {
      assert.ok(
        new Date(result.blocks[i].start) >= new Date(result.blocks[i - 1].end),
        `${result.blocks[i].title} overlaps ${result.blocks[i - 1].title}`,
      );
    }
  });

  test('leaves the buffer unfilled', () => {
    const assignments = fixtureWork();   // far more work than time
    const result = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ, bufferFraction: 0.2 });

    assert.ok(
      result.stats.scheduledMinutes <= result.stats.usableMinutes,
      'scheduled past the usable capacity',
    );
    assert.ok(
      result.stats.scheduledMinutes < result.stats.freeMinutes * 0.85,
      `filled ${result.stats.scheduledMinutes} of ${result.stats.freeMinutes} free minutes — buffer was eaten`,
    );
  });

  test('respects the daily cap', () => {
    const assignments = fixtureWork();
    const result = planWeek(assignments, openWeek({ maxDailyMinutes: 180 }), { now: FIXTURE_MONDAY, tz: TZ });

    const byDay = new Map<string, number>();
    for (const b of result.blocks) {
      const key = localParts(new Date(b.start), TZ).dateKey;
      byDay.set(key, (byDay.get(key) ?? 0) + b.minutes);
    }
    for (const [day, minutes] of byDay) {
      assert.ok(minutes <= 180, `${day} was booked for ${minutes} minutes against a 180 cap`);
    }
  });

  test('caps consecutive time on one course', () => {
    const due = zonedInstant('2026-10-09', 23 * 60 + 59, TZ).toISOString();
    const assignments = [
      makeAssignment({ id: 'p1', kind: 'project', course: 'CSE 121', title: 'Project A', due, estimatedMinutes: 400 }),
      makeAssignment({ id: 'p2', kind: 'project', course: 'CSE 121', title: 'Project B', due, estimatedMinutes: 400 }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ, maxConsecutiveCourseMinutes: 120 });

    let run = 0;
    let prevEnd: Date | null = null;
    for (const b of result.blocks) {
      const start = new Date(b.start);
      const contiguous = prevEnd !== null && start.getTime() - prevEnd.getTime() <= 30 * 60_000;
      run = contiguous ? run + b.minutes : b.minutes;
      assert.ok(run <= 120, `${run} consecutive minutes of ${b.course}`);
      prevEnd = new Date(b.end);
    }
  });

  test('exam sessions land on separate days', () => {
    const assignments = [
      makeAssignment({
        id: 'exam1', kind: 'exam', course: 'CHEM 142', title: 'Midterm 1',
        due: zonedInstant('2026-10-09', 10 * 60, TZ).toISOString(),
        estimatedMinutes: 240, weight: 0.25,
      }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });

    const days = result.blocks.map((b) => localParts(new Date(b.start), TZ).dateKey);
    assert.equal(new Set(days).size, days.length, 'exam prep was crammed onto one day');
    assert.ok(days.length >= 3, `expected the exam spread across several days, got ${days.length}`);
  });

  test('sessions of one assignment run in order', () => {
    const assignments = [
      makeAssignment({ id: 'w1', kind: 'writing', title: 'Essay', due: zonedInstant('2026-10-10', 23 * 60, TZ).toISOString(), estimatedMinutes: 240 }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });
    const mine = result.blocks.filter((b) => b.assignmentId === 'w1');

    for (let i = 1; i < mine.length; i++) {
      assert.equal(mine[i].sessionIndex, mine[i - 1].sessionIndex + 1);
    }
  });

  test('reports what it could not fit instead of dropping it', () => {
    const assignments = fixtureWork();
    const result = planWeek(assignments, openWeek({ maxDailyMinutes: 60 }), { now: FIXTURE_MONDAY, tz: TZ });

    assert.ok(result.unscheduled.length > 0, 'a 60-minute-a-day week cannot absorb a full quarter');
    for (const u of result.unscheduled) {
      assert.ok(u.reason.length > 0, 'every leftover needs a stated reason');

      // The real invariant: a reported leftover is genuinely not fully planned.
      const a = assignments.find((x) => x.id === u.assignmentId);
      if (!a) continue;
      const planned = result.blocks
        .filter((b) => b.assignmentId === u.assignmentId)
        .reduce((s, b) => s + b.minutes, 0);
      assert.ok(
        planned < a.estimatedMinutes,
        `"${u.title}" was reported short but ${planned} of ${a.estimatedMinutes} minutes are planned`,
      );
    }
  });

  test('past deadlines are surfaced, not scheduled', () => {
    // A Canvas feed carries 30 days of history and never says what was handed
    // in. Planning it would bury the real week under work already submitted.
    const assignments = [
      makeAssignment({ id: 'old', kind: 'problem set', title: 'Homework 1', due: zonedInstant('2026-10-01', 23 * 60, TZ).toISOString() }),
      makeAssignment({ id: 'new', kind: 'problem set', title: 'Homework 2', due: zonedInstant('2026-10-08', 23 * 60, TZ).toISOString() }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });

    assert.ok(!result.blocks.some((b) => b.assignmentId === 'old'), 'past-due work should not be scheduled by default');
    assert.ok(result.blocks.some((b) => b.assignmentId === 'new'));
    assert.deepEqual(result.overdue.map((a) => a.id), ['old']);
  });

  test('past deadlines can be opted back in', () => {
    const assignments = [
      makeAssignment({ id: 'old', kind: 'problem set', title: 'Homework 1', due: zonedInstant('2026-10-01', 23 * 60, TZ).toISOString() }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ, includeOverdue: true });
    assert.ok(result.blocks.some((b) => b.assignmentId === 'old'));
  });

  test('an all-day deadline today is still workable this morning', () => {
    // Falls out of dueInstant treating all-day items as end-of-day: get this
    // wrong and every same-day deadline silently reads as already missed.
    const assignments = [
      makeAssignment({
        id: 'today', kind: 'problem set', title: 'Due today',
        due: new Date(Date.UTC(2026, 9, 5, 12)).toISOString(), allDay: true,
      }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });
    assert.equal(result.overdue.length, 0);
    assert.ok(result.blocks.some((b) => b.assignmentId === 'today'));
  });

  test('completed work is not rescheduled', () => {
    const due = zonedInstant('2026-10-09', 23 * 60, TZ).toISOString();
    const assignments = [
      makeAssignment({ id: 'done', kind: 'problem set', title: 'Done already', due, status: 'done' }),
      makeAssignment({ id: 'todo', kind: 'problem set', title: 'Still to do', due, status: 'todo' }),
    ];
    const result = planWeek(assignments, openWeek(), { now: MONDAY_8AM, tz: TZ });

    assert.ok(!result.blocks.some((b) => b.assignmentId === 'done'));
    assert.ok(result.blocks.some((b) => b.assignmentId === 'todo'));
  });

  test('time already logged reduces what gets scheduled', () => {
    const due = zonedInstant('2026-10-09', 23 * 60, TZ).toISOString();
    const fresh = planWeek(
      [makeAssignment({ id: 'x', kind: 'project', title: 'Project', due, estimatedMinutes: 240 })],
      openWeek(), { now: MONDAY_8AM, tz: TZ },
    );
    const partly = planWeek(
      [makeAssignment({ id: 'x', kind: 'project', title: 'Project', due, estimatedMinutes: 240, actualMinutes: 180 })],
      openWeek(), { now: MONDAY_8AM, tz: TZ },
    );
    assert.ok(partly.stats.scheduledMinutes < fresh.stats.scheduledMinutes);
  });

  test('every block explains itself', () => {
    const assignments = fixtureWork(20);
    const result = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });

    for (const b of result.blocks) {
      assert.ok(b.why.length > 15, `weak explanation: "${b.why}"`);
      assert.ok(!b.why.includes('undefined'), `explanation leaked undefined: "${b.why}"`);
      assert.ok(!b.why.includes('NaN'), `explanation leaked NaN: "${b.why}"`);
    }
  });

  test('is deterministic — replanning the same input gives the same schedule', () => {
    // The whole reason the scheduler is not an LLM call. If a student refreshes
    // and their week has shuffled for no reason, they stop trusting it.
    const assignments = fixtureWork(30);
    const a = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });
    const b = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });
    assert.deepEqual(a.blocks, b.blocks);
  });

  test('an empty week produces an empty plan, not a crash', () => {
    const result = planWeek([], openWeek(), { now: MONDAY_8AM, tz: TZ });
    assert.deepEqual(result.blocks, []);
    assert.deepEqual(result.unscheduled, []);
  });

  test('a fully booked student gets nothing scheduled and is told why', () => {
    const busy = Array.from({ length: 7 }, (_, day) => ({
      id: `all-${day}`, day, startMin: 0, endMin: 1439, label: 'Booked', kind: 'commitment' as const,
    }));
    const assignments = fixtureWork(10);
    const result = planWeek(assignments, openWeek({ busy }), { now: FIXTURE_MONDAY, tz: TZ });

    assert.equal(result.blocks.length, 0);
    assert.ok(result.unscheduled.length > 0);
  });

  test('the evening student gets demanding work in the evening', () => {
    const due = zonedInstant('2026-10-09', 23 * 60, TZ).toISOString();
    const assignments = [
      makeAssignment({ id: 'e', kind: 'exam', title: 'Midterm', due, estimatedMinutes: 90, weight: 0.25 }),
      makeAssignment({ id: 'd', kind: 'discussion', title: 'Post', due, estimatedMinutes: 30, weight: 0.01 }),
    ];

    const hourOfExam = (energy: 'morning' | 'evening') => {
      const r = planWeek(assignments, openWeek({ energy }), { now: MONDAY_8AM, tz: TZ, maxConsecutiveCourseMinutes: 45 });
      const block = r.blocks.find((b) => b.assignmentId === 'e');
      return block ? localParts(new Date(block.start), TZ).hour : null;
    };

    const morningHour = hourOfExam('morning');
    const eveningHour = hourOfExam('evening');
    assert.ok(morningHour !== null && eveningHour !== null, 'the exam should be scheduled in both cases');
    assert.ok(eveningHour! > morningHour!, `evening student got ${eveningHour}:00, morning student got ${morningHour}:00`);
  });

  test('plans a real quarter feed in well under a second', () => {
    const assignments = fixtureWork();
    const t0 = performance.now();
    planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });
    const ms = performance.now() - t0;
    // Sits around 20ms. The ceiling is deliberately close: the naive version of
    // this loop took 380ms, which is the difference between a button that feels
    // instant and one that feels broken.
    assert.ok(ms < 150, `took ${ms.toFixed(0)}ms — too slow to feel instant`);
  });

  test('planning across the DST boundary keeps blocks inside waking hours', () => {
    // Clocks go back Nov 1 2026. Deadlines are built to straddle it, because
    // running the fixture here would produce an empty plan and assert nothing.
    const dstStart = zonedInstant('2026-10-29', 8 * 60, TZ);
    const assignments = [
      makeAssignment({ id: 'd1', kind: 'problem set', course: 'MATH 124', title: 'Homework', due: zonedInstant('2026-10-31', 23 * 60 + 59, TZ).toISOString(), estimatedMinutes: 150 }),
      makeAssignment({ id: 'd2', kind: 'exam', course: 'CHEM 142', title: 'Midterm 2', due: zonedInstant('2026-11-03', 10 * 60, TZ).toISOString(), estimatedMinutes: 300, weight: 0.25 }),
      makeAssignment({ id: 'd3', kind: 'writing', course: 'ENGL 131', title: 'Essay 3', due: zonedInstant('2026-11-04', 23 * 60 + 59, TZ).toISOString(), estimatedMinutes: 200 }),
    ];
    const result = planWeek(assignments, openWeek(), { now: dstStart, tz: TZ });

    assert.ok(result.blocks.length >= 6, `expected a full week of blocks, got ${result.blocks.length}`);
    const spansBoundary = result.blocks.some((b) => new Date(b.start) > zonedInstant('2026-11-01', 12 * 60, TZ));
    assert.ok(spansBoundary, 'the plan should reach past the time change');

    for (const b of result.blocks) {
      const p = localParts(new Date(b.start), TZ);
      assert.ok(p.minutesOfDay >= 8 * 60 && p.minutesOfDay < 22 * 60, `${b.title} scheduled at ${p.hour}:00`);
    }
  });
});

describe('rescheduling', () => {
  test('a skipped Monday is absorbed by the rest of the week', () => {
    // The "reschedule my week" button, which is the differentiating feature:
    // the student ignores Monday entirely and asks for a new plan on Tuesday.
    const assignments = fixtureWork(20);
    const tuesdayKey = addDays('2026-08-24', 1);

    const monday = planWeek(assignments, openWeek(), { now: FIXTURE_MONDAY, tz: TZ });
    const tuesday = planWeek(assignments, openWeek(), {
      now: zonedInstant(tuesdayKey, 8 * 60, TZ),
      tz: TZ,
    });

    assert.ok(monday.blocks.length > 0);
    assert.ok(tuesday.blocks.length > 0, 'replanning should still produce a week');
    assert.ok(
      tuesday.blocks.every((b) => new Date(b.start) >= zonedInstant(tuesdayKey, 0, TZ)),
      'replanning must not put work in the past',
    );
    // Monday's work doesn't evaporate — it gets picked up across the days left.
    assert.ok(
      tuesday.stats.scheduledMinutes > 0 &&
        tuesday.blocks.some((b) => monday.blocks.some((m) => m.assignmentId === b.assignmentId)),
      'work planned for Monday should reappear later in the week',
    );
  });

  test('marking a block done stops it being planned again', () => {
    const due = zonedInstant('2026-10-09', 23 * 60, TZ).toISOString();
    const before = planWeek(
      [makeAssignment({ id: 'x', kind: 'problem set', title: 'Set 1', due, estimatedMinutes: 150 })],
      openWeek(), { now: MONDAY_8AM, tz: TZ },
    );
    assert.ok(before.blocks.length >= 2);

    // The student finishes the first session and logs 60 minutes against it.
    const after = planWeek(
      [makeAssignment({ id: 'x', kind: 'problem set', title: 'Set 1', due, estimatedMinutes: 150, actualMinutes: 60, lastTouched: MONDAY_8AM.toISOString() })],
      openWeek(), { now: new Date(MONDAY_8AM.getTime() + 2 * 3_600_000), tz: TZ },
    );
    assert.ok(after.stats.scheduledMinutes < before.stats.scheduledMinutes);
  });
});
