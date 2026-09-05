'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { Assignment, Availability, Commitment, FixedEvent, WorkKind } from '@/lib/types';
import { heronStore, type HeronState } from '@/lib/store';
import { planWeek } from '@/lib/schedule/plan';
import { applyCompletion, applyLearnedEstimates, dropRemaining, resetWeeklyTallies, type Completion } from '@/lib/schedule/complete';
import {
  collisionsWith, describeCollisions, describeDisplaced, pushAside, releaseForEvents,
} from '@/lib/schedule/conflicts';
import { releaseMissed } from '@/lib/schedule/absence';
import { applySleepHours, isLive, type StepId } from '@/lib/onboarding';
import { logEvent } from '@/supabase/events';

/**
 * The one place component state and stored state meet.
 *
 * `hydrated` is false during the server render and the first client pass, so
 * anything that would differ between them can wait a beat rather than causing a
 * mismatch. Everything after that reads real stored state directly.
 */
export function useHeron(tz: string) {
  const state = useSyncExternalStore(
    heronStore.subscribe,
    heronStore.getSnapshot,
    heronStore.getServerSnapshot,
  );

  const hydrated = state !== heronStore.getServerSnapshot();

  /**
   * One step of undo, for the actions that destroy something.
   *
   * There is no server copy and no version history, so a mistaken "drop it" is
   * permanent — and the app deliberately asks people to make quick judgements
   * about their week. A single step covers the realistic case (you just tapped
   * the wrong thing) without pretending to be a document editor.
   */
  const undoRef = useRef<{ state: HeronState; label: string } | null>(null);
  const [undoLabel, setUndoLabel] = useState<string | null>(null);

  const mutate = useCallback((fn: (prev: HeronState) => HeronState) => {
    heronStore.set(fn(heronStore.getSnapshot()));
  }, []);

  /** Mutate, remembering the state before it so it can be put back. */
  const mutateUndoable = useCallback((label: string, fn: (prev: HeronState) => HeronState) => {
    const before = heronStore.getSnapshot();
    undoRef.current = { state: before, label };
    setUndoLabel(label);
    heronStore.set(fn(before));
  }, []);

  const undo = useCallback(() => {
    const held = undoRef.current;
    if (!held) return;
    undoRef.current = null;
    setUndoLabel(null);
    heronStore.set(held.state);
  }, []);

  const dismissUndo = useCallback(() => {
    undoRef.current = null;
    setUndoLabel(null);
  }, []);

  /**
   * Rebuild the plan from right now.
   *
   * Explicit rather than automatic. A schedule that silently reshuffles itself
   * means nothing ever feels missed, and a planner that always says you're fine
   * is one you stop believing.
   */
  /**
   * Rebuild the plan inside a state update.
   *
   * Shared by the replan button and by adding an event, so a schedule produced
   * either way goes through exactly the same path — there is no "quick" version
   * that skips a constraint.
   */
  const planInto = useCallback((prev: HeronState, from: Date): HeronState => {
    const commitments = resetWeeklyTallies(prev.commitments, prev.lastPlannedAt, from, tz);
    const assignments = applyLearnedEstimates(prev.assignments);
    const settled = prev.blocks.filter((b) => b.status !== 'planned' || b.pinned);

    const result = planWeek(assignments, prev.availability, {
      now: from, tz, commitments, existingBlocks: settled, events: prev.events,
    });

    return {
      ...prev,
      assignments,
      commitments,
      blocks: [...settled, ...result.blocks].sort((a, b) => a.start.localeCompare(b.start)),
      unscheduled: result.unscheduled,
      lastPlannedAt: from.toISOString(),
    };
  }, [tz]);

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
        events: prev.events,
      });

      // Counts only. How many blocks a plan produced and how much didn't fit
      // are the two numbers that say whether the scheduler is serving someone
      // well, and neither reveals what the work is.
      logEvent('planned', {
        blocks: result.blocks.length,
        unscheduled: result.unscheduled.length,
        minutes: result.blocks.reduce((t, b) => t + b.minutes, 0),
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

  /**
   * Come back after a stretch away: let go of everything unanswered, then plan
   * from today.
   *
   * Undoable, because it touches a lot at once and the student is being asked
   * to trust it at the moment they are least invested.
   *
   * This does not breach "replanning is explicit". The student pressed the
   * button. The rule is about the app not absorbing failures quietly, and
   * nothing here is quiet: the blocks stay in history marked skipped with no
   * time against them, so the completion numbers still know the week did not
   * happen.
   */
  const startFresh = useCallback((from: Date = new Date()) => {
    mutateUndoable('Started fresh', (prev) => ({
      ...prev,
      blocks: releaseMissed(prev.blocks, from),
    }));
    replan(from);
  }, [mutateUndoable, replan]);

  const complete = useCallback((blockId: string, outcome: Completion, minutes: number | null) => {
    mutate((prev) => ({ ...prev, ...applyCompletion(prev, blockId, outcome, minutes, new Date()) }));
    // The single most informative thing a student does. Whether planned work
    // actually happens is the difference between a calendar and a scheduler.
    logEvent(outcome === 'skipped' ? 'block_skipped' : 'block_done', {
      minutes: minutes ?? 0,
      partial: outcome === 'partial',
    });
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

  /** Removing a weekly commitment throws away its history too, so it's undoable. */
  const removeCommitment = useCallback((id: string) => {
    mutateUndoable('Commitment removed', (prev) => ({
      ...prev,
      commitments: prev.commitments.filter((c) => c.id !== id),
      blocks: prev.blocks.filter((b) => b.commitmentId !== id || b.status !== 'planned'),
    }));
  }, [mutateUndoable]);

  /** "I'm not doing this at all" — stop it consuming the week. */
  const drop = useCallback((blockId: string) => {
    mutateUndoable('Dropped', (prev) => ({ ...prev, ...dropRemaining(prev, blockId) }));
  }, [mutateUndoable]);

  /** Move a block by hand and pin it, so the next replan leaves it alone. */
  /**
   * Move a block by hand, and push whatever it lands on out of the way.
   *
   * Returns what was displaced so the caller can say so. Blocks that quietly
   * stack on top of each other are the same lie the "didn't fit" list exists to
   * avoid, one level down.
   */
  const moveBlock = useCallback((blockId: string, startMs: number): string | null => {
    let notice: string | null = null;

    mutate((prev) => {
      const moved = prev.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const end = new Date(startMs + b.minutes * 60_000).toISOString();
        return { ...b, start: new Date(startMs).toISOString(), end, pinned: true };
      });

      const { blocks, displaced } = pushAside(moved, blockId, {
        dayEndMin: prev.availability.dayEndMin,
      });
      notice = describeDisplaced(displaced);

      return { ...prev, blocks: blocks.sort((a, b) => a.start.localeCompare(b.start)) };
    });
    // A move is the scheduler being told it got an hour wrong. Worth counting:
    // a student correcting it constantly means the scoring function is off.
    logEvent('block_moved');
    return notice;
  }, [mutate]);

  /**
   * Add a one-off, and resolve whatever it lands on.
   *
   * Replanning is normally an explicit button, deliberately: a schedule that
   * silently reshuffles means nothing ever feels missed. This doesn't breach
   * that. The rule is about not absorbing your *failures* quietly — here the
   * student has just told the app about a new constraint, and reacting to an
   * instruction they gave is cause and effect, not silent absorption.
   *
   * Returns a sentence naming what moved, or null when nothing had to.
   */
  const addEvent = useCallback((e: Omit<FixedEvent, 'id'>): string | null => {
    const event: FixedEvent = { ...e, id: `e-${Date.now()}` };
    const before = heronStore.getSnapshot();
    const clashes = collisionsWith(before.blocks, [event]);

    mutate((prev) => {
      const withEvent: HeronState = {
        ...prev,
        events: [...prev.events, event].sort((a, b) => a.start.localeCompare(b.start)),
        // A pinned block still loses to an appointment — an event has a real
        // time in the world and a study block doesn't — so release the pin and
        // let the planner move it.
        blocks: releaseForEvents(prev.blocks, [event]),
      };
      return clashes.length > 0 ? planInto(withEvent, new Date()) : withEvent;
    });

    return describeCollisions(clashes);
  }, [mutate, planInto]);

  /** Change an existing one-off. Editing beats delete-and-retype for a typo. */
  const updateEvent = useCallback((id: string, patch: Partial<Omit<FixedEvent, 'id'>>): string | null => {
    const before = heronStore.getSnapshot();
    const moved = before.events.find((e) => e.id === id);
    const next = moved ? { ...moved, ...patch } : null;
    const clashes = next ? collisionsWith(before.blocks, [next]) : [];

    mutate((prev) => {
      const updated: HeronState = {
        ...prev,
        events: prev.events
          .map((e) => (e.id === id ? { ...e, ...patch } : e))
          .sort((a, b) => a.start.localeCompare(b.start)),
        blocks: next ? releaseForEvents(prev.blocks, [next]) : prev.blocks,
      };
      return clashes.length > 0 ? planInto(updated, new Date()) : updated;
    });

    return describeCollisions(clashes);
  }, [mutate, planInto]);

  const removeEvent = useCallback((id: string) => {
    mutateUndoable('Event removed', (prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== id),
    }));
  }, [mutateUndoable]);

  /**
   * A one-off piece of work with a deadline, entered by hand.
   *
   * Deliberately an `Assignment` rather than a new type: it needs exactly the
   * same treatment as anything from Canvas — split into sessions, ranked,
   * placed, explained. Only where it came from differs, and nothing downstream
   * cares about that.
   */
  const addTask = useCallback((t: {
    title: string; course: string; kind: WorkKind; due: string; estimatedMinutes: number;
  }) => {
    mutate((prev) => {
      const assignment: Assignment = {
        id: `t-${Date.now()}`,
        title: t.title,
        course: t.course || 'Personal',
        courseFull: t.course || 'Personal',
        kind: t.kind,
        due: t.due,
        allDay: false,
        url: null,
        estimatedMinutes: t.estimatedMinutes,
        actualMinutes: 0,
        status: 'todo',
        weight: 0.05,
        confidence: 0.5,
        lastTouched: null,
      };
      return { ...prev, assignments: [...prev.assignments, assignment] };
    });
  }, [mutate]);

  const removeTask = useCallback((id: string) => {
    mutateUndoable('Task removed', (prev) => ({
      ...prev,
      assignments: prev.assignments.filter((a) => a.id !== id),
      blocks: prev.blocks.filter((b) => b.assignmentId !== id),
    }));
  }, [mutateUndoable]);

  /** Replace everything, from an imported backup. */
  const replaceAll = useCallback((next: HeronState) => {
    heronStore.set(next);
  }, []);

  /**
   * Record that a setup step was deliberately declined.
   *
   * Skipping is an answer, not an absence — it's what lets a student with no
   * fixed schedule ever be finished.
   */
  const skipStep = useCallback((id: StepId) => {
    mutate((prev) => ({ ...prev, skippedSteps: { ...prev.skippedSteps, [id]: true } }));
  }, [mutate]);

  /** Un-skip, for the student who changes their mind from Settings. */
  /**
   * Put a finished student back into setup.
   *
   * Being live is permanent by design: a student who says "I have no classes"
   * must never be asked again. The cost of that is there was no way back in at
   * all, which turns a deliberate decision into a trap the first time someone
   * takes a job halfway through the quarter.
   *
   * Clears the answers, never the data. Commitments, availability and the plan
   * all survive; what resets is whether the app considers the questions settled.
   */
  const reopenSetup = useCallback(() => {
    mutate((prev) => ({
      ...prev,
      skippedSteps: {},
      wentLiveAt: null,
      liveNoticeSeen: false,
    }));
  }, [mutate]);

  /**
   * Sleep hours and the fact that they were set, together.
   *
   * Separate from `updateAvailability` so no caller can write the hours and
   * leave the question open, which is exactly what `/setup` did.
   */
  const setSleepHours = useCallback((wakeMin: number, bedMin: number) => {
    mutate((prev) => applySleepHours(prev, wakeMin, bedMin));
  }, [mutate]);

  const confirmSleep = useCallback(() => {
    mutate((prev) => ({ ...prev, sleepConfirmed: true }));
  }, [mutate]);

  /**
   * Stamp the moment setup completed.
   *
   * Kept as a stored timestamp rather than recomputed, so the transition can be
   * celebrated exactly once and never re-fires if a student later removes a
   * commitment and drops back below the bar.
   */
  const markLiveIfReady = useCallback(() => {
    mutate((prev) => (
      !prev.wentLiveAt && isLive(prev)
        ? { ...prev, wentLiveAt: new Date().toISOString() }
        : prev
    ));
  }, [mutate]);

  const ackLive = useCallback(() => {
    mutate((prev) => (prev.liveNoticeSeen ? prev : { ...prev, liveNoticeSeen: true }));
  }, [mutate]);

  const reset = useCallback(() => heronStore.clear(), []);

  return {
    state, hydrated, mutate, replan, complete, drop, moveBlock, replaceAll,
    undo, undoLabel, dismissUndo, removeCommitment,
    addEvent, updateEvent, removeEvent, addTask, removeTask,
    updateAvailability, updateCommitments, reset,
    skipStep, reopenSetup, confirmSleep, setSleepHours, markLiveIfReady, ackLive, startFresh,
  };
}
