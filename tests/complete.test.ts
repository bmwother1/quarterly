import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Assignment, Commitment, StudyBlock } from '../src/lib/types.ts';
import {
  applyCompletion, markAssignmentDone, applyLearnedEstimates,
  missedBlocks, resetWeeklyTallies,
} from '../src/lib/schedule/complete.ts';
import { zonedInstant } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
const NOW = zonedInstant('2026-10-07', 18 * 60, TZ);   // a Wednesday evening

function assignment(over: Partial<Assignment> & { id: string }): Assignment {
  return {
    title: 'Homework', course: 'MATH 124', courseFull: 'MATH 124 A',
    kind: 'problem set', due: zonedInstant('2026-10-09', 23 * 60, TZ).toISOString(),
    allDay: false, url: null, estimatedMinutes: 120, actualMinutes: 0,
    status: 'todo', weight: 0.05, confidence: 0.5, lastTouched: null, ...over,
  };
}

function commitment(over: Partial<Commitment> & { id: string }): Commitment {
  return {
    title: 'Run', category: 'fitness', sessionsPerWeek: 5, minutesPerSession: 35,
    importance: 0.8, demand: 0.25, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
    minSessionMinutes: 30, bufferAfterMinutes: 10, windowStartMin: null, windowEndMin: null,
    active: true, shade: 0, ...over,
  };
}

function block(over: Partial<StudyBlock> & { id: string }): StudyBlock {
  return {
    assignmentId: null, commitmentId: null, course: 'MATH 124', title: 'Homework',
    start: zonedInstant('2026-10-07', 17 * 60, TZ).toISOString(),
    end: zonedInstant('2026-10-07', 18 * 60, TZ).toISOString(),
    minutes: 60, method: 'practice problems', why: 'because',
    sessionIndex: 1, sessionCount: 2, status: 'planned', actualMinutes: null, ...over,
  };
}

describe('marking a block done', () => {
  const base = () => ({
    assignments: [assignment({ id: 'hw' })],
    commitments: [commitment({ id: 'run' })],
    blocks: [block({ id: 'b1', assignmentId: 'hw' }), block({ id: 'b2', assignmentId: 'hw' })],
  });

  test('logs the time against the assignment', () => {
    const r = applyCompletion(base(), 'b1', 'done', null, NOW);
    assert.equal(r.assignments[0].actualMinutes, 60);
    assert.equal(r.blocks[0].status, 'done');
  });

  test('records a partial honestly', () => {
    const r = applyCompletion(base(), 'b1', 'partial', 25, NOW);
    assert.equal(r.assignments[0].actualMinutes, 25);
    assert.equal(r.blocks[0].status, 'partial');
  });

  test('a skip logs no time and does not count as contact', () => {
    const r = applyCompletion(base(), 'b1', 'skipped', null, NOW);
    assert.equal(r.assignments[0].actualMinutes, 0);
    assert.equal(r.assignments[0].lastTouched, null, 'a skipped block is not contact with the material');
    assert.equal(r.blocks[0].status, 'skipped');
  });

  test('re-marking a block does not double-count the time', () => {
    // The bug this prevents: incrementing rather than summing, so a student who
    // corrects a mistake burns down work they never did.
    let s = applyCompletion(base(), 'b1', 'done', null, NOW);
    s = applyCompletion(s, 'b1', 'partial', 30, NOW);
    assert.equal(s.assignments[0].actualMinutes, 30);
  });

  test('finishing the estimate closes the assignment', () => {
    let s = applyCompletion(base(), 'b1', 'done', null, NOW);
    s = applyCompletion(s, 'b2', 'done', 60, NOW);
    assert.equal(s.assignments[0].actualMinutes, 120);
    assert.equal(s.assignments[0].status, 'done');
  });

  test('a commitment session advances the weekly tally', () => {
    const state = {
      assignments: [],
      commitments: [commitment({ id: 'run' })],
      blocks: [block({ id: 'r1', commitmentId: 'run', course: 'Run', title: 'Run' })],
    };
    const r = applyCompletion(state, 'r1', 'done', null, NOW);
    assert.equal(r.commitments[0].doneThisWeek, 1);
    assert.equal(r.commitments[0].lastDoneAt, NOW.toISOString());
  });

  test('a skipped commitment session does not advance the tally', () => {
    const state = {
      assignments: [],
      commitments: [commitment({ id: 'run' })],
      blocks: [block({ id: 'r1', commitmentId: 'run' })],
    };
    const r = applyCompletion(state, 'r1', 'skipped', null, NOW);
    assert.equal(r.commitments[0].doneThisWeek, 0);
    assert.equal(r.commitments[0].lastDoneAt, null);
  });

  test('an unknown block id is a no-op, not a crash', () => {
    const r = applyCompletion(base(), 'nope', 'done', null, NOW);
    assert.equal(r.blocks.length, 2);
  });
});

describe('marking an assignment done outright', () => {
  test('closes it without needing the estimate burned down', () => {
    // The estimate is often wrong in the student's favour. Forcing them to log
    // phantom hours to clear something already submitted is deletion-grade friction.
    const out = markAssignmentDone([assignment({ id: 'hw' })], 'hw', NOW);
    assert.equal(out[0].status, 'done');
    assert.equal(out[0].actualMinutes, 0);
  });
});

describe('learning from observed durations', () => {
  test('a finished assignment corrects the estimate for similar work', () => {
    const done = assignment({ id: 'a', status: 'done', actualMinutes: 240, estimatedMinutes: 120 });
    const next = assignment({ id: 'b', estimatedMinutes: 120 });
    const out = applyLearnedEstimates([done, next]);
    const revised = out.find((a) => a.id === 'b')!;
    assert.ok(revised.estimatedMinutes > 120, 'students underestimate; the estimate should rise');
    assert.ok(revised.estimatedMinutes <= 240);
  });

  test('learning is scoped to the course and work type', () => {
    const chemLab = assignment({ id: 'lab', course: 'CHEM 142', kind: 'lab', status: 'done', actualMinutes: 300 });
    const mathHw = assignment({ id: 'hw', course: 'MATH 124', kind: 'problem set', estimatedMinutes: 120 });
    const out = applyLearnedEstimates([chemLab, mathHw]);
    assert.equal(out.find((a) => a.id === 'hw')!.estimatedMinutes, 120, 'a chem lab says nothing about math homework');
  });

  test('finished work is left alone', () => {
    const done = assignment({ id: 'a', status: 'done', actualMinutes: 240, estimatedMinutes: 120 });
    const out = applyLearnedEstimates([done]);
    assert.equal(out[0].estimatedMinutes, 120);
  });
});

describe('what slipped', () => {
  test('past blocks never marked either way are surfaced', () => {
    // The middle ground between silent reshuffling, which makes a planner
    // fiction, and nagging.
    const blocks = [
      block({ id: 'past', end: zonedInstant('2026-10-07', 12 * 60, TZ).toISOString() }),
      block({ id: 'future', end: zonedInstant('2026-10-08', 12 * 60, TZ).toISOString() }),
      block({ id: 'handled', end: zonedInstant('2026-10-07', 12 * 60, TZ).toISOString(), status: 'done' }),
    ];
    const missed = missedBlocks(blocks, NOW);
    assert.deepEqual(missed.map((b) => b.id), ['past']);
  });
});

describe('weekly quota reset', () => {
  test('tallies reset when the week rolls over', () => {
    // Without this, a student who ran five times last week never gets another
    // run scheduled again.
    const last = zonedInstant('2026-10-04', 12 * 60, TZ).toISOString();   // previous Sunday
    const out = resetWeeklyTallies([commitment({ id: 'run', doneThisWeek: 5 })], last, NOW, TZ);
    assert.equal(out[0].doneThisWeek, 0);
  });

  test('tallies survive within the same week', () => {
    const last = zonedInstant('2026-10-06', 12 * 60, TZ).toISOString();   // Tuesday, same week
    const out = resetWeeklyTallies([commitment({ id: 'run', doneThisWeek: 3 })], last, NOW, TZ);
    assert.equal(out[0].doneThisWeek, 3);
  });

  test('a first plan resets nothing', () => {
    const out = resetWeeklyTallies([commitment({ id: 'run', doneThisWeek: 2 })], null, NOW, TZ);
    assert.equal(out[0].doneThisWeek, 2);
  });
});

describe('replanning around what already happened', () => {
  test('hours already spent are not offered again', async () => {
    const { planWeek } = await import('../src/lib/schedule/plan.ts');
    const { defaultAvailability } = await import('../src/lib/schedule/slots.ts');

    const av = { ...defaultAvailability(), energy: 'steady' as const, maxDailyMinutes: 600 };
    const monday = zonedInstant('2026-10-05', 8 * 60, TZ);

    const spent = block({
      id: 'spent', commitmentId: 'run', status: 'done', actualMinutes: 60,
      start: zonedInstant('2026-10-05', 10 * 60, TZ).toISOString(),
      end: zonedInstant('2026-10-05', 11 * 60, TZ).toISOString(),
    });

    const filler = commitment({ id: 'x', title: 'Filler', sessionsPerWeek: 7, minutesPerSession: 60, maxPerDay: 1 });
    const r = planWeek([], av, { now: monday, tz: TZ, commitments: [filler], existingBlocks: [spent] });

    const spentStart = new Date(spent.start).getTime();
    const spentEnd = new Date(spent.end).getTime();
    for (const b of r.blocks) {
      const s = new Date(b.start).getTime();
      const e = new Date(b.end).getTime();
      assert.ok(e <= spentStart || s >= spentEnd, `"${b.title}" overlaps an hour already spent`);
    }
  });

  test('a commitment already done today is not scheduled again today', async () => {
    const { planWeek } = await import('../src/lib/schedule/plan.ts');
    const { defaultAvailability } = await import('../src/lib/schedule/slots.ts');

    const av = { ...defaultAvailability(), energy: 'steady' as const, maxDailyMinutes: 600 };
    const monday = zonedInstant('2026-10-05', 8 * 60, TZ);

    const ranAlready = block({
      id: 'ran', commitmentId: 'run', status: 'done', actualMinutes: 35,
      start: zonedInstant('2026-10-05', 6 * 60 + 30, TZ).toISOString(),
      end: zonedInstant('2026-10-05', 7 * 60 + 5, TZ).toISOString(),
    });

    const runs = commitment({ id: 'run', sessionsPerWeek: 5, doneThisWeek: 1, maxPerDay: 1 });
    const r = planWeek([], av, { now: monday, tz: TZ, commitments: [runs], existingBlocks: [ranAlready] });

    const mondayRuns = r.blocks.filter(
      (b) => b.commitmentId === 'run' && b.start.startsWith('2026-10-05'),
    );
    assert.equal(mondayRuns.length, 0, 'replanning scheduled a second run on a day already run');
  });
});

describe('block identity', () => {
  test('ids stay unique across a replan that keeps history', async () => {
    // The bug: ids were `key::sessionIndex`, and sessionIndex restarts at 1 on
    // every replan. A completed session 1 and a newly planned session 1 then
    // collided, and React dropped or duplicated blocks.
    const { planWeek } = await import('../src/lib/schedule/plan.ts');
    const { defaultAvailability } = await import('../src/lib/schedule/slots.ts');

    const av = { ...defaultAvailability(), energy: 'steady' as const, maxDailyMinutes: 600 };
    const monday = zonedInstant('2026-10-05', 8 * 60, TZ);
    const runs = commitment({ id: 'run', sessionsPerWeek: 5 });

    const first = planWeek([], av, { now: monday, tz: TZ, commitments: [runs] });
    const done = { ...first.blocks[0], status: 'done' as const, actualMinutes: 35 };

    const tuesday = zonedInstant('2026-10-06', 8 * 60, TZ);
    const second = planWeek([], av, {
      now: tuesday, tz: TZ,
      commitments: [{ ...runs, doneThisWeek: 1 }],
      existingBlocks: [done],
    });

    const all = [done, ...second.blocks];
    const ids = all.map((b) => b.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate block ids: ${ids.join(', ')}`);
  });
});

describe('one-off fixed events', () => {
  test('the scheduler never books over them', async () => {
    // An appointment's time is already decided. The only job here is to not
    // double-book it — the same treatment hours already spent get.
    const { planWeek } = await import('../src/lib/schedule/plan.ts');
    const { defaultAvailability } = await import('../src/lib/schedule/slots.ts');

    const av = { ...defaultAvailability(), energy: 'steady' as const, maxDailyMinutes: 600 };
    const monday = zonedInstant('2026-10-05', 8 * 60, TZ);

    const dentist = {
      id: 'ev1', title: 'Dentist', note: null, category: 'personal' as const, shade: 0,
      start: zonedInstant('2026-10-05', 10 * 60, TZ).toISOString(),
      end: zonedInstant('2026-10-05', 11 * 60, TZ).toISOString(),
    };

    const filler = commitment({ id: 'f', title: 'Filler', sessionsPerWeek: 7, minutesPerSession: 60, maxPerDay: 1 });
    const r = planWeek([], av, { now: monday, tz: TZ, commitments: [filler], events: [dentist] });

    const evStart = new Date(dentist.start).getTime();
    const evEnd = new Date(dentist.end).getTime();
    assert.ok(r.blocks.length > 0, 'expected a plan around the appointment, not an empty one');
    for (const b of r.blocks) {
      const s = new Date(b.start).getTime();
      const e = new Date(b.end).getTime();
      assert.ok(e <= evStart || s >= evEnd, `"${b.title}" overlaps the dentist appointment`);
    }
  });

  test('an all-day-length event still leaves other days usable', async () => {
    const { planWeek } = await import('../src/lib/schedule/plan.ts');
    const { defaultAvailability } = await import('../src/lib/schedule/slots.ts');

    const av = { ...defaultAvailability(), energy: 'steady' as const, maxDailyMinutes: 600 };
    const monday = zonedInstant('2026-10-05', 8 * 60, TZ);

    const wedding = {
      id: 'ev2', title: 'Wedding', note: null, category: 'personal' as const, shade: 0,
      start: zonedInstant('2026-10-06', 8 * 60, TZ).toISOString(),
      end: zonedInstant('2026-10-06', 22 * 60, TZ).toISOString(),
    };

    const filler = commitment({ id: 'f', title: 'Filler', sessionsPerWeek: 5, minutesPerSession: 60, maxPerDay: 1 });
    const r = planWeek([], av, { now: monday, tz: TZ, commitments: [filler], events: [wedding] });

    const onWeddingDay = r.blocks.filter((b) => b.start.startsWith('2026-10-06'));
    assert.equal(onWeddingDay.length, 0, 'the whole day was taken');
    assert.ok(r.blocks.length > 0, 'other days should still be planned');
  });
});

describe('backup', () => {
  test('a round trip preserves everything', async () => {
    const { toBackup, fromBackup } = await import('../src/lib/backup.ts');
    const { emptyState } = await import('../src/lib/store.ts');

    const state = {
      ...emptyState(),
      commitments: [commitment({ id: 'run', title: 'Run' })],
      blocks: [block({ id: 'b1', status: 'done' as const, actualMinutes: 45 })],
    };

    const r = fromBackup(JSON.stringify(toBackup(state)));
    assert.ok(r.ok);
    assert.equal(r.state.commitments[0].title, 'Run');
    assert.equal(r.state.blocks[0].actualMinutes, 45);
    assert.match(r.summary, /1 weekly commitments/);
  });

  test('a backup from an older build still loads', async () => {
    // Merged over a fresh empty state, so a field added since the export was
    // written can't come back undefined and crash a render.
    const { fromBackup } = await import('../src/lib/backup.ts');
    const old = JSON.stringify({
      format: 'quarterly-backup', version: 1, exportedAt: '2026-08-01T00:00:00.000Z',
      state: { courses: [], assignments: [], commitments: [], blocks: [], availability: { busy: [] } },
    });
    const r = fromBackup(old);
    assert.ok(r.ok, r.ok ? '' : r.error);
    assert.deepEqual(r.state.events, [], 'a field the old build never had should default, not vanish');
  });

  test('junk is refused with a reason, never half-loaded', async () => {
    const { fromBackup } = await import('../src/lib/backup.ts');
    for (const bad of ['not json', '{}', '[]', 'null', JSON.stringify({ format: 'something-else' })]) {
      const r = fromBackup(bad);
      assert.ok(!r.ok, `expected rejection of ${bad}`);
      assert.ok(r.error.length > 10, 'a rejection has to say what went wrong');
    }
  });

  test('a damaged backup is caught before it reaches a render', async () => {
    const { fromBackup } = await import('../src/lib/backup.ts');
    const damaged = JSON.stringify({
      format: 'quarterly-backup', version: 1,
      state: { commitments: 'not-a-list', availability: { busy: [] } },
    });
    const r = fromBackup(damaged);
    assert.ok(!r.ok);
    assert.match(r.error, /commitments/);
  });
});
