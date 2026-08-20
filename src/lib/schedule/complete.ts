/**
 * What happens when a student checks something off.
 *
 * This is the feedback loop the whole product rests on. Marking a block done has
 * to change what gets planned next, or the checkbox is decoration and the
 * schedule slowly becomes fiction.
 *
 * Three things move:
 *   - the assignment's `actualMinutes`, so the estimate stops being a guess
 *   - `lastTouched` / `lastDoneAt`, which drives the spacing and staleness terms
 *   - the commitment's weekly tally, which drives quota pressure
 *
 * Skipping is recorded, not silently absorbed. A student who skipped three
 * blocks should see that they skipped three blocks.
 */

import type { Assignment, Commitment, StudyBlock } from '../types.ts';
import { reviseEstimate } from '../canvas/interpret.ts';
import { localParts } from '../time.ts';

export type Completion = 'done' | 'skipped' | 'partial';

/**
 * What a skip means. Asking is the point.
 *
 * A skip is ambiguous and the two meanings need opposite handling: "not now,
 * find me another slot" is work that still exists, and "I'm not doing this" is
 * work that should stop consuming the week. Guessing either way is wrong — one
 * makes the app nag about something abandoned, the other silently loses
 * something that mattered.
 */
export type SkipIntent = 'reschedule' | 'drop';

export interface ApplyResult {
  blocks: StudyBlock[];
  assignments: Assignment[];
  commitments: Commitment[];
}

/**
 * Record an outcome against one block.
 *
 * `minutes` is what was actually spent. For 'done' it defaults to the planned
 * length; for 'partial' the caller supplies it. That number is the single most
 * valuable piece of data the product collects, because students underestimate
 * durations by around a factor of two and nothing else corrects for it.
 */
export function applyCompletion(
  state: { blocks: StudyBlock[]; assignments: Assignment[]; commitments: Commitment[] },
  blockId: string,
  outcome: Completion,
  minutes: number | null,
  now: Date,
): ApplyResult {
  const block = state.blocks.find((b) => b.id === blockId);
  if (!block) return { ...state };

  const spent = outcome === 'skipped' ? 0 : (minutes ?? block.minutes);

  const blocks = state.blocks.map((b) =>
    b.id === blockId ? { ...b, status: outcome, actualMinutes: spent } : b,
  );

  const assignments = state.assignments.map((a) => {
    if (a.id !== block.assignmentId) return a;

    // Sum every completed block for this assignment rather than incrementing,
    // so re-marking a block doesn't double-count the time.
    const logged = blocks
      .filter((b) => b.assignmentId === a.id && b.actualMinutes !== null)
      .reduce((s, b) => s + (b.actualMinutes ?? 0), 0);

    return {
      ...a,
      actualMinutes: logged,
      lastTouched: outcome === 'skipped' ? a.lastTouched : now.toISOString(),
      status: logged >= a.estimatedMinutes && outcome !== 'skipped' ? ('done' as const) : a.status,
    };
  });

  const commitments = state.commitments.map((c) => {
    if (c.id !== block.commitmentId) return c;
    if (outcome === 'skipped') return c;

    return {
      ...c,
      lastDoneAt: now.toISOString(),
      doneThisWeek: c.doneThisWeek + 1,
    };
  });

  return { blocks, assignments, commitments };
}

/**
 * Mark an assignment finished outright, regardless of time logged.
 *
 * Needed because the estimate is often wrong in the student's favour, and being
 * forced to burn down a phantom two hours to clear something you've already
 * submitted is exactly the kind of friction that gets a planner deleted.
 */
export function markAssignmentDone(assignments: Assignment[], id: string, now: Date): Assignment[] {
  return assignments.map((a) =>
    a.id === id ? { ...a, status: 'done' as const, lastTouched: now.toISOString() } : a,
  );
}

/**
 * Fold observed durations back into the estimate for similar future work.
 *
 * Grouped by course and work type, because "how long a CHEM problem set takes
 * me" is a far better predictor than either the course or the type alone.
 */
export function learnedEstimates(assignments: Assignment[]): Map<string, number> {
  const observed = new Map<string, number[]>();

  for (const a of assignments) {
    if (a.status !== 'done' || a.actualMinutes <= 0) continue;
    const key = `${a.course}:${a.kind}`;
    const list = observed.get(key) ?? [];
    list.push(a.actualMinutes);
    observed.set(key, list);
  }

  const out = new Map<string, number>();
  for (const [key, times] of observed) {
    const seed = assignments.find((a) => `${a.course}:${a.kind}` === key)?.estimatedMinutes ?? 60;
    out.set(key, reviseEstimate(seed, times));
  }
  return out;
}

export function applyLearnedEstimates(assignments: Assignment[]): Assignment[] {
  const learned = learnedEstimates(assignments);
  return assignments.map((a) => {
    if (a.status === 'done') return a;
    const revised = learned.get(`${a.course}:${a.kind}`);
    return revised ? { ...a, estimatedMinutes: revised } : a;
  });
}

/**
 * Blocks whose time has passed and that were never marked either way.
 *
 * The honest middle ground between silently reshuffling — which makes a planner
 * fiction, because nothing ever feels missed — and nagging. Surface what slipped
 * and let the student decide, then replan on their say-so.
 */
export function missedBlocks(blocks: StudyBlock[], now: Date): StudyBlock[] {
  return blocks.filter((b) => b.status === 'planned' && new Date(b.end) < now);
}

/** Blocks for one local day, in order. */
export function blocksOnDay(blocks: StudyBlock[], dateKey: string, tz: string): StudyBlock[] {
  return blocks
    .filter((b) => localParts(new Date(b.start), tz).dateKey === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Which weekly tallies to reset, given the last plan was in a previous week.
 *
 * Quotas are weekly, so `doneThisWeek` has to go back to zero on Monday or a
 * student who ran five times last week never gets another run scheduled.
 */
export function resetWeeklyTallies(
  commitments: Commitment[],
  lastPlannedAt: string | null,
  now: Date,
  tz: string,
): Commitment[] {
  if (!lastPlannedAt) return commitments;

  const then = localParts(new Date(lastPlannedAt), tz);
  const today = localParts(now, tz);
  const thenMonday = weekKey(then.dateKey, then.weekday);
  const todayMonday = weekKey(today.dateKey, today.weekday);
  if (thenMonday === todayMonday) return commitments;

  return commitments.map((c) => ({ ...c, doneThisWeek: 0 }));
}

function weekKey(dateKey: string, weekday: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - weekday)).toISOString().slice(0, 10);
}

/**
 * Drop the remaining work for whatever a block belonged to.
 *
 * For coursework that means marking the assignment done so it stops being
 * planned. For a commitment it means counting this week's session as spent, so
 * the quota isn't chased for the rest of the week. Neither pretends the work
 * happened; both stop the app arguing about it.
 */
export function dropRemaining(
  state: { blocks: StudyBlock[]; assignments: Assignment[]; commitments: Commitment[] },
  blockId: string,
): ApplyResult {
  const block = state.blocks.find((b) => b.id === blockId);
  if (!block) return { ...state };

  const blocks = state.blocks.filter(
    (b) => b.id === blockId || b.status !== 'planned' ||
      (b.assignmentId !== block.assignmentId || block.assignmentId === null) &&
      (b.commitmentId !== block.commitmentId || block.commitmentId === null),
  );

  const assignments = state.assignments.map((a) =>
    a.id === block.assignmentId ? { ...a, status: 'dropped' as const } : a,
  );

  const commitments = state.commitments.map((c) =>
    c.id === block.commitmentId
      ? { ...c, doneThisWeek: Math.min(c.sessionsPerWeek, c.doneThisWeek + 1) }
      : c,
  );

  return { blocks, assignments, commitments };
}
