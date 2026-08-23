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

export type SyncDirection = 'push' | 'pull' | 'nothing';

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

  // Both sides have something. The question is whether the server holds changes
  // this device has never seen, which is what `lastSyncedAt` records.
  const seen = local.lastSyncedAt ? Date.parse(local.lastSyncedAt) : 0;
  const remoteMovedSinceWeLooked = Date.parse(remote.updatedAt) > seen;

  // Prefer the copy this device cannot reproduce over the one in front of us.
  return remoteMovedSinceWeLooked ? 'pull' : 'push';
}
