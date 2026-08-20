'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { Availability, Commitment } from '@/lib/types';
import { quarterlyStore, type QuarterlyState } from '@/lib/store';
import { planWeek } from '@/lib/schedule/plan';
import { applyCompletion, applyLearnedEstimates, dropRemaining, resetWeeklyTallies, type Completion } from '@/lib/schedule/complete';

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
      // Settled *and* hand-placed blocks survive. Moving a block by hand only
      // means something if the scheduler then works around it.
      const settled = prev.blocks.filter((b) => b.status !== 'planned' || b.pinned);

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

  /**
   * Updater form, deliberately.
   *
   * Taking a plain value means every caller builds its update from whatever the
   * component captured at render time. Two edits in quick succession then both
   * derive from the same stale snapshot, and the second silently discards the
   * first — which is exactly how a saved work shift disappeared.
   */
  const updateAvailability = useCallback((fn: (prev: Availability) => Availability) => {
    mutate((prev) => ({ ...prev, availability: fn(prev.availability) }));
  }, [mutate]);

  const updateCommitments = useCallback((fn: (prev: Commitment[]) => Commitment[]) => {
    mutate((prev) => ({ ...prev, commitments: fn(prev.commitments) }));
  }, [mutate]);

  /** "I'm not doing this at all" — stop it consuming the week. */
  const drop = useCallback((blockId: string) => {
    mutate((prev) => ({ ...prev, ...dropRemaining(prev, blockId) }));
  }, [mutate]);

  /** Move a block by hand and pin it, so the next replan leaves it alone. */
  const moveBlock = useCallback((blockId: string, startMs: number) => {
    mutate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const end = new Date(startMs + b.minutes * 60_000).toISOString();
        return { ...b, start: new Date(startMs).toISOString(), end, pinned: true };
      }).sort((a, b) => a.start.localeCompare(b.start)),
    }));
  }, [mutate]);

  const reset = useCallback(() => quarterlyStore.clear(), []);

  return { state, hydrated, mutate, replan, complete, drop, moveBlock, updateAvailability, updateCommitments, reset };
}
