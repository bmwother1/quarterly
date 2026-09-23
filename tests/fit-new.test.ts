import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fitNewWork } from '../src/lib/schedule/fit-new.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { emptyState, type HeronState } from '../src/lib/store.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { localParts } from '../src/lib/time.ts';
import type { Assignment, Commitment } from '../src/lib/types.ts';

/**
 * A daily Canvas refresh is only acceptable if it never rearranges the week the
 * student already saw. Every test here is a way it could quietly do otherwise.
 */

const TZ = 'America/Los_Angeles';
const now = new Date('2026-10-12T16:00:00.000Z'); // Monday 9am in Seattle
const inDays = (d: number, hourUtc = 6) =>
  new Date(Date.UTC(2026, 9, 12 + d, hourUtc, 59)).toISOString();

function assignment(id: string, over: Partial<Assignment> = {}): Assignment {
  return {
    id, title: id, course: 'CHEM 142', courseFull: 'CHEM 142 A', kind: 'problem set',
    due: inDays(4), allDay: false, url: null, estimatedMinutes: 120, actualMinutes: 0,
    status: 'todo', weight: 0.03, confidence: 0.5, lastTouched: null, ...over,
  };
}

const run: Commitment = {
  id: 'run', title: 'Run', category: 'fitness', sessionsPerWeek: 3, minutesPerSession: 40,
  importance: 0.6, demand: 0.3, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
  minSessionMinutes: 30, bufferAfterMinutes: 10, windowStartMin: 6 * 60, windowEndMin: 21 * 60,
  active: true, shade: 0,
};

/** A student with a planned week, the way the app leaves it after "Plan my week". */
function plannedWeek(assignments: Assignment[], maxDailyMinutes = 300): HeronState {
  const availability = { ...defaultAvailability(), maxDailyMinutes };
  const base = { ...emptyState(), availability, assignments, commitments: [run] };
  const plan = planWeek(assignments, availability, { now, tz: TZ, commitments: [run] });
  return { ...base, blocks: plan.blocks, unscheduled: plan.unscheduled };
}

const snapshot = (s: HeronState) => s.blocks.map((b) => `${b.id}@${b.start}`).sort();

describe('fitting new Canvas work into a planned week', () => {
  test('nothing already planned moves', () => {
    const before = plannedWeek([assignment('a1'), assignment('a2', { due: inDays(6) })]);
    const withNew = { ...before, assignments: [...before.assignments, assignment('new', { due: inDays(3) })] };

    const { next } = fitNewWork(withNew, { addedIds: ['new'], movedIds: [] }, now, TZ);

    const kept = new Set(snapshot(before));
    for (const key of snapshot(before)) assert.ok(snapshot(next).includes(key), `moved or lost: ${key}`);
    assert.ok(next.blocks.some((b) => b.assignmentId === 'new'), 'the new work got time');
    assert.equal(next.blocks.length - before.blocks.length,
      next.blocks.filter((b) => !kept.has(`${b.id}@${b.start}`)).length);
  });

  test('new sessions never overlap existing ones', () => {
    const before = plannedWeek([assignment('a1'), assignment('a2')]);
    const withNew = { ...before, assignments: [...before.assignments, assignment('new', { estimatedMinutes: 240 })] };
    const { next } = fitNewWork(withNew, { addedIds: ['new'], movedIds: [] }, now, TZ);

    const sorted = [...next.blocks].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(Date.parse(sorted[i].start) >= Date.parse(sorted[i - 1].end),
        `${sorted[i - 1].title} overlaps ${sorted[i].title}`);
    }
  });

  test('the daily ceiling holds across old and new blocks together', () => {
    // The trap: blocks remove hours but the planner's per-day allowance is
    // computed from availability alone, so without chargeExistingToCap a full
    // day would take its whole allowance again.
    const cap = 120;
    const before = plannedWeek(
      Array.from({ length: 6 }, (_, i) => assignment(`a${i}`, { due: inDays(2 + (i % 3)) })),
      cap,
    );
    const withNew = { ...before, assignments: [...before.assignments, assignment('new', { due: inDays(5), estimatedMinutes: 300 })] };
    const { next } = fitNewWork(withNew, { addedIds: ['new'], movedIds: [] }, now, TZ);

    const perDay = new Map<string, number>();
    for (const b of next.blocks) {
      if (!b.assignmentId) continue; // commitments have their own quota
      const k = localParts(new Date(b.start), TZ).dateKey;
      perDay.set(k, (perDay.get(k) ?? 0) + b.minutes);
    }
    for (const [day, minutes] of perDay) {
      const before_ = before.blocks.filter((b) => b.assignmentId && localParts(new Date(b.start), TZ).dateKey === day)
        .reduce((s, b) => s + b.minutes, 0);
      // A day the original plan already filled past the cap is the original
      // plan's business; the refresh must not add to it.
      assert.ok(minutes <= Math.max(cap, before_), `${day}: ${minutes} min against a ${cap} min ceiling`);
    }
  });

  test('what does not fit is reported, not dropped', () => {
    const before = plannedWeek([assignment('a1')], 60);
    const huge = assignment('huge', { due: inDays(1), estimatedMinutes: 900 });
    const { next, short } = fitNewWork({ ...before, assignments: [...before.assignments, huge] },
      { addedIds: ['huge'], movedIds: [] }, now, TZ);
    assert.deepEqual(short.map((a) => a.id), ['huge']);
    assert.ok(next.unscheduled.some((u) => u.assignmentId === 'huge'));
  });

  test('commitments are not booked a second time', () => {
    const before = plannedWeek([assignment('a1')]);
    const runsBefore = before.blocks.filter((b) => b.commitmentId === 'run').length;
    const { next } = fitNewWork({ ...before, assignments: [...before.assignments, assignment('new')] },
      { addedIds: ['new'], movedIds: [] }, now, TZ);
    assert.equal(next.blocks.filter((b) => b.commitmentId === 'run').length, runsBefore);
  });

  test('a deadline moved earlier re-places only the sessions now past it', () => {
    const before = plannedWeek([assignment('a1', { due: inDays(9) }), assignment('a2', { due: inDays(9) })]);
    const lateBlock = before.blocks.filter((b) => b.assignmentId === 'a1').at(-1)!;
    // Canvas pulls a1 forward to before its last planned session.
    const earlier = new Date(Date.parse(lateBlock.start) - 3_600_000).toISOString();
    const moved = before.assignments.map((a) => (a.id === 'a1' ? { ...a, due: earlier } : a));

    const { next } = fitNewWork({ ...before, assignments: moved }, { addedIds: [], movedIds: ['a1'] }, now, TZ);

    for (const b of next.blocks.filter((x) => x.assignmentId === 'a1' && x.status === 'planned')) {
      assert.ok(Date.parse(b.end) <= Date.parse(earlier), 'a session still sits after the new deadline');
    }
    const a2Before = before.blocks.filter((b) => b.assignmentId === 'a2').map((b) => b.start);
    const a2After = next.blocks.filter((b) => b.assignmentId === 'a2').map((b) => b.start);
    assert.deepEqual(a2After, a2Before, 'an unrelated assignment moved');
  });

  test('a deadline moved later touches nothing', () => {
    const before = plannedWeek([assignment('a1', { due: inDays(5) })]);
    const moved = before.assignments.map((a) => ({ ...a, due: inDays(7) }));
    const { next, placed } = fitNewWork({ ...before, assignments: moved }, { addedIds: [], movedIds: ['a1'] }, now, TZ);
    assert.deepEqual(snapshot(next), snapshot(before));
    assert.equal(placed.length, 0);
  });

  test('no news is no change, down to the reference', () => {
    const before = plannedWeek([assignment('a1')]);
    assert.equal(fitNewWork(before, { addedIds: [], movedIds: [] }, now, TZ).next, before);
  });
});
