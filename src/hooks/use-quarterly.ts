'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Availability, Commitment } from '@/lib/types';
import { quarterlyStore, type QuarterlyState } from '@/lib/store';
import { planWeek } from '@/lib/schedule/plan';
import { applyCompletion, applyLearnedEstimates, resetWeeklyTallies, type Completion } from '@/lib/schedule/complete';

/**
 * The one place component state and stored state meet.
 *
 * `hydrated` is false during the server render and the first client pass, so
 * anything that would differ between them can wait a beat rather than causing a
 * mismatch. Everything after that reads real stored state directly.
 */
export function useQuarterly(tz: string) {
  const state = useSyncExternalStore(
    quarterlyStore.subscribe,
    quarterlyStore.getSnapshot,
    quarterlyStore.getServerSnapshot,
  );

  const hydrated = state !== quarterlyStore.getServerSnapshot();

  const mutate = useCallback((fn: (prev: QuarterlyState) => QuarterlyState) => {
    quarterlyStore.set(fn(quarterlyStore.getSnapshot()));
  }, []);

  /**
   * Rebuild the plan from right now.
   *
   * Explicit rather than automatic. A schedule that silently reshuffles itself
   * means nothing ever feels missed, and a planner that always says you're fine
   * is one you stop believing.
   */
  const replan = useCallback((from: Date = new Date()) => {
    mutate((prev) => {
      // A new week zeroes the quotas, or last week's five runs mean no runs ever again.
      const commitments = resetWeeklyTallies(prev.commitments, prev.lastPlannedAt, from, tz);
      const assignments = applyLearnedEstimates(prev.assignments);

      // History is kept; only blocks still marked 'planned' are replaced. The
      // settled ones are handed to the planner so it works around them rather
      // than double-booking hours that were already spent.
      const settled = prev.blocks.filter((b) => b.status !== 'planned');

      const result = planWeek(assignments, prev.availability, {
        now: from,
        tz,
        commitments,
        existingBlocks: settled,
      });

      return {
        ...prev,
        assignments,
        commitments,
        blocks: [...settled, ...result.blocks].sort((a, b) => a.start.localeCompare(b.start)),
        unscheduled: result.unscheduled,
        lastPlannedAt: from.toISOString(),
      };
    });
  }, [mutate, tz]);

  const complete = useCallback((blockId: string, outcome: Completion, minutes: number | null) => {
    mutate((prev) => ({ ...prev, ...applyCompletion(prev, blockId, outcome, minutes, new Date()) }));
  }, [mutate]);

  const setAvailability = useCallback((availability: Availability) => {
    mutate((prev) => ({ ...prev, availability }));
  }, [mutate]);

  const setCommitments = useCallback((commitments: Commitment[]) => {
    mutate((prev) => ({ ...prev, commitments }));
  }, [mutate]);

  const reset = useCallback(() => quarterlyStore.clear(), []);

  return { state, hydrated, mutate, replan, complete, setAvailability, setCommitments, reset };
}
