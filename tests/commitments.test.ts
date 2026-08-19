import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Commitment, Availability } from '../src/lib/types.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { energyAt, quotaPressure, importanceFactor, fitForDemand } from '../src/lib/schedule/score.ts';
import { localParts, zonedInstant } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
/** Monday 2026-10-05, 06:30 local — the moment Brydon's day actually starts. */
const MONDAY = zonedInstant('2026-10-05', 6 * 60 + 30, TZ);

function commitment(over: Partial<Commitment> & { id: string; title: string }): Commitment {
  return {
    category: 'personal',
    sessionsPerWeek: 3,
    minutesPerSession: 45,
    importance: 0.5,
    demand: 0.4,
    lastDoneAt: null,
    doneThisWeek: 0,
    maxPerDay: 1,
    minSessionMinutes: 25,
    bufferAfterMinutes: 0,
    windowStartMin: null,
    windowEndMin: null,
    active: true,
    color: '#888888',
    ...over,
  };
}

/**
 * Brydon's real week, which is the reason any of this exists: a full-time job
 * with a commute either side, and a short night.
 */
function workingWeek(over: Partial<Availability> = {}): Availability {
  const base = defaultAvailability();
  const busy = [];
  for (let day = 0; day < 7; day++) {
    busy.push({ id: `sleep-${day}`, day, startMin: 0, endMin: 6 * 60 + 30, label: 'Sleep', kind: 'sleep' as const });
    busy.push({ id: `night-${day}`, day, startMin: 24 * 60 - 1, endMin: 24 * 60, label: 'Sleep', kind: 'sleep' as const });
  }
  for (let day = 0; day < 5; day++) {
    // 7:30–16:00 shift with 15 minutes of commute either side.
    busy.push({ id: `work-${day}`, day, startMin: 7 * 60 + 15, endMin: 16 * 60 + 15, label: 'Masons Supply', kind: 'work' as const });
  }
  return { ...base, busy, dayStartMin: 6 * 60 + 30, dayEndMin: 24 * 60, energy: 'bimodal', maxDailyMinutes: 360, ...over };
}

describe('the bimodal energy curve', () => {
  test('peaks early and late, dips through the working day', () => {
    // The pattern that exists because the first real user fit none of the others.
    assert.ok(energyAt(7, 'bimodal') > energyAt(13, 'bimodal'));
    assert.ok(energyAt(20, 'bimodal') > energyAt(13, 'bimodal'));
    assert.ok(energyAt(7, 'bimodal') > 0.9);
    assert.ok(energyAt(20, 'bimodal') > 0.9);
  });

  test('demanding work fits both peaks and not the trough', () => {
    assert.ok(fitForDemand(0.9, 7, 'bimodal') > fitForDemand(0.9, 14, 'bimodal'));
    assert.ok(fitForDemand(0.9, 20, 'bimodal') > fitForDemand(0.9, 14, 'bimodal'));
  });

  test('low-demand work is happiest in the trough', () => {
    // A run belongs in an hour that deep work would waste.
    assert.ok(fitForDemand(0.25, 14, 'bimodal') > fitForDemand(0.25, 20, 'bimodal'));
  });
});

describe('quota pressure', () => {
  test('rises as the week runs out', () => {
    assert.ok(quotaPressure(3, 6) < quotaPressure(3, 3));
    assert.ok(quotaPressure(3, 3) < quotaPressure(3, 1));
  });

  test('is zero once the target is met', () => {
    assert.equal(quotaPressure(0, 3), 0);
    assert.equal(quotaPressure(-1, 3), 0);
  });

  test('lands in the same band as assignment urgency', () => {
    // Both feed one priority scale. If the ranges diverged, one category would
    // silently outrank the other regardless of what the student cares about.
    assert.ok(quotaPressure(1, 6) >= 1 && quotaPressure(5, 1) <= 5.1);
    assert.ok(importanceFactor(0) >= 0.6 && importanceFactor(1) <= 1.6);
  });
});

describe('scheduling recurring commitments', () => {
  const runs = commitment({
    id: 'run', title: 'Run 3 miles', category: 'fitness',
    sessionsPerWeek: 5, minutesPerSession: 35, importance: 0.7, demand: 0.25,
  });

  test('schedules the week\'s remaining sessions', () => {
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });
    const mine = r.blocks.filter((b) => b.commitmentId === 'run');
    assert.equal(mine.length, 5, `expected 5 runs, got ${mine.length}`);
  });

  test('puts them on five different days', () => {
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });
    const days = r.blocks.filter((b) => b.commitmentId === 'run')
      .map((b) => localParts(new Date(b.start), TZ).dateKey);
    assert.equal(new Set(days).size, days.length, 'five runs on fewer than five days');
  });

  test('counts sessions already done this week', () => {
    const r = planWeek([], workingWeek(), {
      now: MONDAY, tz: TZ, commitments: [{ ...runs, doneThisWeek: 3 }],
    });
    assert.equal(r.blocks.filter((b) => b.commitmentId === 'run').length, 2);
  });

  test('schedules nothing once the target is met', () => {
    const r = planWeek([], workingWeek(), {
      now: MONDAY, tz: TZ, commitments: [{ ...runs, doneThisWeek: 5 }],
    });
    assert.equal(r.blocks.filter((b) => b.commitmentId === 'run').length, 0);
  });

  test('skips inactive commitments', () => {
    const r = planWeek([], workingWeek(), {
      now: MONDAY, tz: TZ, commitments: [{ ...runs, active: false }],
    });
    assert.equal(r.blocks.length, 0);
  });

  test('never schedules during the work shift', () => {
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });
    for (const b of r.blocks) {
      const start = localParts(new Date(b.start), TZ);
      const end = localParts(new Date(b.end), TZ);
      if (start.weekday > 4) continue;
      assert.ok(
        end.minutesOfDay <= 7 * 60 + 15 || start.minutesOfDay >= 16 * 60 + 15,
        `${b.title} at ${start.hour}:${String(start.minute).padStart(2, '0')} collides with the shift`,
      );
    }
  });

  test('never schedules during sleep', () => {
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });
    for (const b of r.blocks) {
      const start = localParts(new Date(b.start), TZ);
      assert.ok(start.minutesOfDay >= 6 * 60 + 30, `${b.title} scheduled at ${start.hour}:00`);
    }
  });

  test('every commitment block explains itself in quota terms', () => {
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });
    for (const b of r.blocks) {
      assert.match(b.why, /of 5 this week/, `unexpected explanation: "${b.why}"`);
      assert.ok(!b.why.includes('undefined') && !b.why.includes('NaN'));
    }
  });

  test('a neglected commitment outranks a fresh one of equal weight', () => {
    const stale = commitment({ id: 'stale', title: 'Stale', sessionsPerWeek: 1, lastDoneAt: '2026-09-20T12:00:00Z' });
    const fresh = commitment({ id: 'fresh', title: 'Fresh', sessionsPerWeek: 1, lastDoneAt: '2026-10-04T12:00:00Z' });

    // One slot only, so the two must actually compete.
    const tight = workingWeek({ maxDailyMinutes: 45 });
    const r = planWeek([], tight, { now: MONDAY, tz: TZ, days: 1, commitments: [stale, fresh] });

    assert.ok(r.blocks.length >= 1);
    assert.equal(r.blocks[0].commitmentId, 'stale', 'the neglected one should go first');
  });

  test('coursework and commitments compete rather than one category winning outright', () => {
    const assignments = [{
      id: 'hw', title: 'Homework 4', course: 'MATH 124', courseFull: 'MATH 124 A',
      kind: 'problem set' as const, due: zonedInstant('2026-10-08', 23 * 60, TZ).toISOString(),
      allDay: false, url: null, estimatedMinutes: 120, actualMinutes: 0,
      status: 'todo' as const, weight: 0.05, confidence: 0.5, lastTouched: null,
    }];
    const r = planWeek(assignments, workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs] });

    assert.ok(r.blocks.some((b) => b.assignmentId === 'hw'), 'coursework got squeezed out entirely');
    assert.ok(r.blocks.some((b) => b.commitmentId === 'run'), 'commitments got squeezed out entirely');
  });

  test('reports shortfall honestly when the week cannot hold the quota', () => {
    // Six once-a-day sessions with only three days of horizon left. Three of
    // them cannot exist, and the planner has to say so rather than quietly
    // dropping them — pretending the week is fine is how a planner loses trust.
    const greedy = commitment({
      id: 'greedy', title: 'Six a week', sessionsPerWeek: 6, minutesPerSession: 60, importance: 0.9,
    });
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, days: 3, commitments: [greedy] });

    const placed = r.blocks.filter((b) => b.commitmentId === 'greedy').length;
    assert.ok(placed <= 3, `only three days available, but ${placed} sessions were placed`);

    const short = r.unscheduled.find((u) => u.commitmentId === 'greedy');
    assert.ok(short, 'a quota that cannot fit must be reported, not silently dropped');
    assert.equal(short!.sessionsShort, 6 - placed);
  });

  test('a session is trimmed rather than skipped when the day is nearly full', () => {
    // Partial progress beats no progress, so a 90-minute session in a 45-minute
    // day becomes 45 minutes rather than vanishing.
    const long = commitment({ id: 'long', title: 'Long', sessionsPerWeek: 1, minutesPerSession: 90 });
    const r = planWeek([], workingWeek({ maxDailyMinutes: 45 }), { now: MONDAY, tz: TZ, commitments: [long] });

    const block = r.blocks.find((b) => b.commitmentId === 'long');
    assert.ok(block, 'expected a trimmed session rather than nothing');
    assert.equal(block!.minutes, 45);
  });

  test('a hard time window is respected', () => {
    // Running is low-demand, so a low-energy hour "fits" perfectly and the
    // scheduler will happily put a run at 11pm for someone asleep at midnight.
    // Physiology isn't in the scoring function, so the window is a hard filter.
    const evening = commitment({
      id: 'run', title: 'Run', category: 'fitness', sessionsPerWeek: 5,
      minutesPerSession: 35, demand: 0.25,
      windowStartMin: 6 * 60, windowEndMin: 21 * 60,
    });
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [evening] });

    assert.ok(r.blocks.length > 0);
    for (const b of r.blocks) {
      const start = localParts(new Date(b.start), TZ);
      const end = localParts(new Date(b.end), TZ);
      assert.ok(start.minutesOfDay >= 6 * 60, `starts at ${start.hour}:00, before the window`);
      assert.ok(end.minutesOfDay <= 21 * 60, `ends at ${end.hour}:00, past the window`);
    }
  });

  test('a trailing buffer is held, not just decorated', () => {
    // Ten minutes in the shower is real time. Nothing may be scheduled into it.
    const runs = commitment({
      id: 'run', title: 'Run', category: 'fitness', sessionsPerWeek: 5,
      minutesPerSession: 35, bufferAfterMinutes: 10, demand: 0.25,
    });
    const study = commitment({
      id: 'study', title: 'Study', category: 'learning', sessionsPerWeek: 5,
      minutesPerSession: 45, demand: 0.85,
    });
    const r = planWeek([], workingWeek(), { now: MONDAY, tz: TZ, commitments: [runs, study] });

    for (const run of r.blocks.filter((b) => b.commitmentId === 'run')) {
      const runEnd = new Date(run.end).getTime();
      for (const other of r.blocks) {
        if (other.id === run.id) continue;
        const otherStart = new Date(other.start).getTime();
        if (otherStart >= runEnd) {
          assert.ok(
            otherStart - runEnd >= 10 * 60_000,
            `"${other.title}" starts ${(otherStart - runEnd) / 60000} min after the run, inside the buffer`,
          );
        }
      }
    }
  });

  test('a session below its own minimum is not scheduled at all', () => {
    // A Pi, a radar sensor and a server. Twenty minutes is setup and nothing else.
    const needsAnHour = commitment({
      id: 'rig', title: 'Launch monitor', category: 'project',
      sessionsPerWeek: 3, minutesPerSession: 90, minSessionMinutes: 60,
    });
    const r = planWeek([], workingWeek({ maxDailyMinutes: 45 }), {
      now: MONDAY, tz: TZ, commitments: [needsAnHour],
    });

    for (const b of r.blocks) {
      assert.ok(b.minutes >= 60, `scheduled a ${b.minutes}-minute session below the 60-minute floor`);
    }
    assert.ok(r.unscheduled.some((u) => u.commitmentId === 'rig'), 'the shortfall should be reported');
  });

  test('the daily ceiling can differ by weekday', () => {
    // Three hours after a nine-hour shift, five on an open weekend.
    const filler = commitment({
      id: 'fill', title: 'Filler', sessionsPerWeek: 7, minutesPerSession: 90, maxPerDay: 1,
    });
    const av = workingWeek({ maxDailyMinutesByDay: [90, 90, 90, 90, 90, 300, 300] });
    const r = planWeek([], av, { now: MONDAY, tz: TZ, commitments: [filler] });

    const byDay = new Map<number, number>();
    for (const b of r.blocks) {
      const wd = localParts(new Date(b.start), TZ).weekday;
      byDay.set(wd, (byDay.get(wd) ?? 0) + b.minutes);
    }
    for (const [wd, minutes] of byDay) {
      const cap = wd <= 4 ? 90 : 300;
      assert.ok(minutes <= cap, `weekday ${wd} booked ${minutes} against a ${cap} ceiling`);
    }
  });

  test('work slides onto an open day instead of stacking on a full one', () => {
    // The bug this prevents: 4.6h piled onto Tuesday after a full workday while
    // a wide-open Saturday sits nearly empty. Same shape as a student with a
    // free Sunday and a brutal Wednesday.
    const load = [
      commitment({ id: 'a', title: 'A', category: 'project', sessionsPerWeek: 3, minutesPerSession: 90, minSessionMinutes: 60 }),
      commitment({ id: 'b', title: 'B', category: 'project', sessionsPerWeek: 3, minutesPerSession: 90, minSessionMinutes: 60 }),
      commitment({ id: 'c', title: 'C', category: 'learning', sessionsPerWeek: 3, minutesPerSession: 60, minSessionMinutes: 45 }),
    ];
    const av = workingWeek({ maxDailyMinutesByDay: [180, 180, 180, 180, 180, 300, 300] });
    const r = planWeek([], av, { now: MONDAY, tz: TZ, commitments: load });

    const weekendMinutes = r.blocks
      .filter((b) => localParts(new Date(b.start), TZ).weekday >= 5)
      .reduce((s, b) => s + b.minutes, 0);

    assert.ok(weekendMinutes > 0, 'the open weekend was left empty while weeknights filled up');
  });

  test('is still deterministic with both sources in play', () => {
    const opts = { now: MONDAY, tz: TZ, commitments: [runs] };
    const a = planWeek([], workingWeek(), opts);
    const b = planWeek([], workingWeek(), opts);
    assert.deepEqual(a.blocks, b.blocks);
  });

  test('a run lands in the trough, deep work does not', () => {
    const study = commitment({
      id: 'stanford', title: 'Stanford AI course', category: 'learning',
      sessionsPerWeek: 2, minutesPerSession: 60, importance: 0.6, demand: 0.85,
    });
    // Saturday, so the whole day is open and the hour is a real choice.
    const saturday = zonedInstant('2026-10-10', 6 * 60 + 30, TZ);
    const r = planWeek([], workingWeek(), { now: saturday, tz: TZ, days: 1, commitments: [runs, study] });

    const run = r.blocks.find((b) => b.commitmentId === 'run');
    const learn = r.blocks.find((b) => b.commitmentId === 'stanford');
    if (run && learn) {
      const runEnergy = energyAt(localParts(new Date(run.start), TZ).hour, 'bimodal');
      const learnEnergy = energyAt(localParts(new Date(learn.start), TZ).hour, 'bimodal');
      assert.ok(learnEnergy >= runEnergy, 'the course should get the sharper hour, not the run');
    }
  });
});
