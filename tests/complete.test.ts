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
    active: true, color: '#10b981', ...over,
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
