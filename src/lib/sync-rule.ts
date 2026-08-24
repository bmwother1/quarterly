import type { QuarterlyState } from './store.ts';

/**
 * Which copy of a student's week wins, when there are two.
 *
 * Pure and kept in the domain layer on purpose. The expensive mistake in sync is
 * silent: push an empty local state over a good remote one and a student's whole
 * schedule is gone with nothing to report it. That deserves a rule you can read
 * in one place and test without a network.
 *
 * There is no merge, and that is a decision rather than an omission. The
 * realistic case is one student on one phone; building conflict resolution
 * nobody will ever see costs a week the interviews need more.
 */

/**
 * `conflict` means both sides changed since they were last level. There is no
 * merge, so the only honest answers are "pick one and lose the other" or "do
 * nothing and say so". This picks the second: a sync that silently discards a
 * week is far worse than one that doesn't happen.
 */
export type SyncDirection = 'push' | 'pull' | 'nothing' | 'conflict';

export interface RemoteMeta {
  /** ISO timestamp of the server's last write. */
  updatedAt: string;
  /** Whether the server copy has anything in it. */
  hasContent: boolean;
}

/**
 * A state worth protecting.
 *
 * **`availability` belongs here and its absence was a real bug.** Classes, work
 * shifts and sleep all live in `availability.busy`, so a device holding a
 * student's entire real timetable, and nothing else, counted as empty and got
 * silently overwritten by an older server copy on sign-in. That is precisely
 * the failure this module was written to prevent, missed because "content" was
 * read as "things to schedule" rather than "work the student did".
 *
 * Blocks still don't count: they are regenerated from everything else, so a
 * state holding only blocks has nothing a replan could not rebuild.
 *
 * The default sleep entries don't count either. Every fresh install has those,
 * so counting them would make every device look non-empty and no first sign-in
 * would ever pull.
 */
export function hasContent(s: QuarterlyState): boolean {
  return s.commitments.length > 0
    || s.assignments.length > 0
    || s.events.length > 0
    || s.availability.busy.some((b) => b.kind !== 'sleep');
}

export function decideDirection(local: QuarterlyState, remote: RemoteMeta | null): SyncDirection {
  const seen = local.lastSyncedAt ? Date.parse(local.lastSyncedAt) : 0;

  /**
   * Does this device hold work the server has not got?
   *
   * This is the only question that should ever authorise an overwrite, and the
   * first version got it wrong by asking whether the device looked *empty*
   * instead. A student who set up a work schedule and nothing else looked empty
   * and lost the lot.
   *
   * With no modification stamp, fall back to whether there is anything here at
   * all: that state was written before the field existed and its edits are
   * still real.
   */
  const localDirty = local.lastModifiedAt
    ? Date.parse(local.lastModifiedAt) > seen
    : hasContent(local);

  // Nothing on the server yet. This device creates the row, if it has anything
  // worth creating it with.
  if (!remote) return hasContent(local) || localDirty ? 'push' : 'nothing';

  const remoteMoved = Date.parse(remote.updatedAt) > seen;

  // Two empty copies have nothing to exchange, however old either looks.
  if (!localDirty && !hasContent(local) && !remote.hasContent) return 'nothing';

  // The rule, in one line: a device with unsaved work is never overwritten.
  if (localDirty && remoteMoved) return 'conflict';
  if (localDirty) return 'push';
  if (remoteMoved) return 'pull';
  return 'nothing';
}

/**
 * State after a successful push.
 *
 * Split out and kept pure because the invariant is easy to break and fails
 * silently: `lastModifiedAt` must not move. A push that marks the device dirty
 * makes the next change detector fire immediately, and auto-push loops forever
 * against the network until something gives.
 */
export function afterPush(local: QuarterlyState, at: string): QuarterlyState {
  return { ...local, lastSyncedAt: at };
}

/**
 * State after a successful pull.
 *
 * Same invariant from the other side. The device has just received the server's
 * copy, so it is level with it, and stamping `lastModifiedAt` with the moment of
 * receipt would make it look like this device had unsynced edits. It would then
 * push straight back over the thing it just pulled. The server copy's own
 * modification time is what carries across; `at` is only a fallback for a copy
 * written before that field existed.
 */
export function afterPull(remote: QuarterlyState, at: string): QuarterlyState {
  return {
    ...remote,
    lastSyncedAt: at,
    lastModifiedAt: remote.lastModifiedAt ?? at,
  };
}
