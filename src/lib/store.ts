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

import type { Assignment, Availability, Commitment, Course, StudyBlock } from './types.ts';
import { defaultAvailability } from './schedule/slots.ts';

export interface QuarterlyState {
  version: number;
  courses: Course[];
  assignments: Assignment[];
  commitments: Commitment[];
  availability: Availability;
  /** The current plan. Regenerated on demand, not derived on every render. */
  blocks: StudyBlock[];
  lastPlannedAt: string | null;
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
    availability: defaultAvailability(),
    blocks: [],
    lastPlannedAt: null,
    lastSyncedAt: null,
  };
}

export interface Store {
  load(): QuarterlyState;
  save(state: QuarterlyState): void;
  clear(): void;
}

export const localStore: Store = {
  load() {
    if (typeof window === 'undefined') return emptyState();
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<QuarterlyState>;
      // Merge over a fresh empty state so a stored blob written by an older
      // build can never leave a field undefined and crash a render.
      return { ...emptyState(), ...parsed, version: VERSION };
    } catch {
      return emptyState();
    }
  },

  save(state) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Quota exceeded or storage disabled. Losing the write is survivable;
      // throwing in the middle of a click handler is not.
    }
  },

  clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(KEY);
  },
};
