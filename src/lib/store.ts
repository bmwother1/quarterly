/**
 * Persistence.
 *
 * A deliberately small interface with a localStorage implementation behind it.
 * Nothing above this layer knows where state lives, so moving to Supabase later
 * is a second adapter rather than a rewrite of every component.
 *
 * Local-first for now because the alternative is asking a student to create an
 * account before they've seen anything work, which is the single biggest
 * drop-off point in a product a classmate mentioned to them once.
 */

import type { Assignment, Availability, Commitment, Course, FixedEvent, StudyBlock } from './types.ts';
import type { UnscheduledItem } from './schedule/plan.ts';
import { defaultAvailability } from './schedule/slots.ts';

export interface QuarterlyState {
  version: number;
  courses: Course[];
  assignments: Assignment[];
  commitments: Commitment[];
  /** One-off things at fixed times: appointments, gigs, an exam sitting. */
  events: FixedEvent[];
  availability: Availability;
  /** The current plan. Regenerated on demand, not derived on every render. */
  blocks: StudyBlock[];
  /**
   * What the last plan could not fit.
   *
   * Stored rather than recomputed because it's the product's most important
   * output after the schedule itself. A planner that hides this is one you quit
   * in week 4, having believed it right up until the week fell apart.
   */
  unscheduled: UnscheduledItem[];
  lastPlannedAt: string | null;
  /**
   * Steps the student explicitly declined. Kept apart from the data because
   * "I have no fixed schedule" and "I haven't said yet" look identical in the
   * data and mean opposite things.
   */
  skippedSteps?: Partial<Record<'work' | 'fixed' | 'sleep' | 'calendars', boolean>>;
  /** Sleep always has a default, so this records that it was actually looked at. */
  sleepConfirmed?: boolean;
  /** Set once, when setup completes. Setup prompts never appear again after. */
  wentLiveAt?: string | null;
  /**
   * Whether the "you're set up" confirmation has been seen.
   *
   * Separate from `wentLiveAt` because the two answer different questions: one
   * is when setup ended, the other is whether we've told them. Deriving the
   * second from the first would re-show the notice on every reload.
   */
  liveNoticeSeen?: boolean;
  /**
   * When this device last changed the plan, as opposed to last talking to the
   * server.
   *
   * Without it, "this device has edits the server hasn't seen" has to be
   * inferred from `lastSyncedAt`, and a device that has never synced reads as
   * infinitely old. That made a week built offline lose to any server copy,
   * silently. The two timestamps answer different questions and both are needed.
   */
  lastModifiedAt?: string | null;
  lastSyncedAt: string | null;
  /**
   * Deliberately absent: the Canvas feed URL.
   *
   * It's a bearer credential for a student's entire schedule. Keeping it in
   * localStorage means every script on the page can read it, so it is used once
   * to fetch and then dropped. Re-syncing costs a paste; a leaked feed URL costs
   * a real person's privacy, permanently.
   */
}

const KEY = 'quarterly.state.v1';
const VERSION = 1;

export function emptyState(): QuarterlyState {
  return {
    version: VERSION,
    courses: [],
    assignments: [],
    commitments: [],
    events: [],
    availability: defaultAvailability(),
    blocks: [],
    unscheduled: [],
    lastPlannedAt: null,
    skippedSteps: {},
    sleepConfirmed: false,
    wentLiveAt: null,
    liveNoticeSeen: false,
    lastModifiedAt: null,
    lastSyncedAt: null,
  };
}

/**
 * An observable store, shaped for `useSyncExternalStore`.
 *
 * The obvious alternative — read localStorage in an effect and setState — is
 * what React 19 now flags, and for good reason: it renders once with empty
 * state, once more with the real state, and every consumer sees a flash of
 * "you have nothing planned". This renders the right thing on the first client
 * pass instead.
 *
 * Snapshots must be reference-stable. Returning a fresh object each call makes
 * useSyncExternalStore believe the store changed on every render and loop.
 */

/** A single frozen instance, so the server snapshot is always the same reference. */
const SERVER_SNAPSHOT: QuarterlyState = Object.freeze(emptyState()) as QuarterlyState;

let cache: QuarterlyState | null = null;
const listeners = new Set<() => void>();

function read(): QuarterlyState {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<QuarterlyState>;
    // Merge over a fresh empty state so a blob written by an older build can
    // never leave a field undefined and crash a render.
    return { ...emptyState(), ...parsed, version: VERSION };
  } catch {
    return emptyState();
  }
}

export const quarterlyStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    // Another tab writing to localStorage is a real update, not a stale one.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cache = null;
        for (const l of listeners) l();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },

  getSnapshot(): QuarterlyState {
    if (cache === null) cache = read();
    return cache;
  },

  getServerSnapshot(): QuarterlyState {
    return SERVER_SNAPSHOT;
  },

  /**
   * `touch: false` is for writes that are not a student changing their plan:
   * recording a sync, or replacing local state with what the server sent. Left
   * true they would mark the device dirty on every sync and it would never stop
   * pushing.
   */
  set(next: QuarterlyState, opts: { touch?: boolean } = {}): void {
    const touch = opts.touch !== false;
    if (touch) next = { ...next, lastModifiedAt: new Date().toISOString() };
    cache = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Quota exceeded or storage disabled. Losing the write is survivable;
        // throwing inside a click handler is not.
      }
    }
    for (const l of listeners) l();
  },

  clear(): void {
    cache = emptyState();
    if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
    for (const l of listeners) l();
  },
};
