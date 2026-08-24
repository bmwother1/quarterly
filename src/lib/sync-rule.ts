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

/** A state worth protecting. Blocks alone don't count: they're regenerated. */
export function hasContent(s: QuarterlyState): boolean {
  return s.commitments.length > 0 || s.assignments.length > 0 || s.events.length > 0;
}

export function decideDirection(local: QuarterlyState, remote: RemoteMeta | null): SyncDirection {
  // Nothing on the server yet. This device creates the row, if it has anything
  // worth creating it with.
  if (!remote) return hasContent(local) ? 'push' : 'nothing';

  // A fresh install signing in to an existing account. The server is the only
  // copy that exists, and overwriting it with an empty week is the exact
  // failure this rule is written to prevent.
  if (!hasContent(local)) return remote.hasContent ? 'pull' : 'nothing';

  const seen = local.lastSyncedAt ? Date.parse(local.lastSyncedAt) : 0;

  // Two independent questions, and conflating them was the original bug.
  const remoteMoved = Date.parse(remote.updatedAt) > seen;
  const localDirty = local.lastModifiedAt
    ? Date.parse(local.lastModifiedAt) > seen
    // No modification stamp at all means a state written before this field
    // existed. Treat a week with content as dirty rather than assume it is
    // disposable.
    : true;

  if (remoteMoved && localDirty) return 'conflict';
  if (remoteMoved) return 'pull';
  if (localDirty) return 'push';
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
