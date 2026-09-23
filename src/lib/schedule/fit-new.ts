/**
 * Fitting newly published work into a week without rearranging it.
 *
 * Why this exists rather than a replan: a daily Canvas refresh that ran the full
 * planner would reshuffle every block the student has already looked at, every
 * morning, because an instructor posted a reading. That is the week that changes
 * under you, and it is what the deterministic-scheduler rule exists to prevent.
 *
 * So a refresh does the smallest honest thing. Everything already in the plan
 * stays exactly where it is. Only the work that just arrived, or whose deadline
 * just moved, is placed, and only into time that is still free. What cannot fit
 * goes on the "didn't fit" list like anything else, where the student can see it
 * and decide whether a full replan is worth it.
 */

import type { HeronState } from '../store.ts';
import type { Assignment } from '../types.ts';
import { planWeek, dueInstant } from './plan.ts';

export interface FitResult {
  next: HeronState;
  /** Assignments that got at least one session. */
  placed: Assignment[];
  /** Assignments that needed time and got none, or not enough. */
  short: Assignment[];
}

export function fitNewWork(
  prev: HeronState,
  merge: { addedIds: string[]; movedIds: string[] },
  now: Date,
  tz: string,
): FitResult {
  const byId = new Map(prev.assignments.map((a) => [a.id, a]));

  /**
   * A moved deadline only matters if a session now sits after it. One that
   * moved later leaves every session valid, and moving them anyway would be
   * exactly the reshuffle this file exists to avoid.
   */
  const strandedIds = merge.movedIds.filter((id) => {
    const a = byId.get(id);
    if (!a) return false;
    const due = dueInstant(a, tz).getTime();
    return prev.blocks.some((b) =>
      b.assignmentId === id && b.status === 'planned' && Date.parse(b.end) > due);
  });

  const targetIds = new Set([...merge.addedIds, ...strandedIds]);
  const targets = [...targetIds]
    .map((id) => byId.get(id))
    .filter((a): a is Assignment => !!a && a.status === 'todo');

  if (targets.length === 0) return { next: prev, placed: [], short: [] };

  // Stranded sessions go; nothing else in the plan is touched. Pinned ones go
  // too if they are past the new deadline, since a pin is a promise about when
  // to work, not permission to work after the thing is due.
  const blocks = prev.blocks.filter((b) =>
    !(b.assignmentId && targetIds.has(b.assignmentId) && b.status === 'planned'));

  const result = planWeek(targets, prev.availability, {
    now,
    tz,
    // Commitments are already planned; passing them would book them twice.
    commitments: [],
    existingBlocks: blocks,
    events: prev.events,
    chargeExistingToCap: true,
  });

  const placedIds = new Set(result.blocks.map((b) => b.assignmentId).filter(Boolean));
  const shortIds = new Set(result.unscheduled.map((u) => u.assignmentId).filter(Boolean));

  return {
    next: {
      ...prev,
      blocks: [...blocks, ...result.blocks].sort((a, b) => a.start.localeCompare(b.start)),
      unscheduled: [
        ...prev.unscheduled.filter((u) => !u.assignmentId || !targetIds.has(u.assignmentId)),
        ...result.unscheduled,
      ],
    },
    placed: targets.filter((a) => placedIds.has(a.id)),
    short: targets.filter((a) => shortIds.has(a.id)),
  };
}
