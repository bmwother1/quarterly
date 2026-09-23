/**
 * Calendar links, remembered on this device and, when signed in, on the account.
 *
 * **Why this is a separate store rather than a field on `HeronState`.** That
 * object is the sync payload: `push()` writes it wholesale into `plan_state` as
 * plain JSON, and `toBackup()` writes it into a JSON file in someone's Downloads
 * folder. A feed URL is a password to a student's whole schedule, so it never
 * goes in either. Keeping it out of that object is what makes that structural
 * instead of a promise somebody has to remember.
 *
 * **Synced to the account, encrypted, since 2026-09-23.** It started as
 * device-only, and that broke the case that matters: a link pasted on a laptop
 * could never be refreshed from the phone, and getting the link on a phone is
 * the hard part. Signed in, each change here is sent to `/api/feeds`, which
 * encrypts the link before it reaches the database (`src/app/api/feeds/seal.ts`).
 * Signed out, nothing leaves this browser, exactly as before. The account side
 * lives in `src/supabase/feed-sync.ts`; this file only reports what changed.
 * See `context/decisions.md`, 2026-09-23.
 *
 * **One entry per calendar, not one slot.** Canvas, a work app and a club
 * calendar are three links that all go stale the same way.
 *
 * **Opt-in per link, and reversible in one tap.** Nothing is remembered unless
 * the student ticks the box; each link can be forgotten on its own from the
 * import page or Settings, which forgets it on every device, and Delete my data
 * forgets them all.
 *
 * The residual risk on the device: anything that can run script on this origin
 * can read this key. That is already true of the student's whole schedule
 * sitting next door in `quarterly.state.v1`, and Heron loads no third-party
 * script.
 */

import { sameCalendar } from './feed-sync-rule.ts';

const KEY = 'heron.feeds.v2';
/** The single-slot Canvas store this replaced. Read once, migrated, removed. */
const LEGACY_KEY = 'heron.feed.v1';

export interface RememberedFeed {
  /** The credential. Never rendered, never logged, never sent anywhere but /api/feed. */
  url: string;
  /**
   * Host only, for showing on screen. The path of a feed URL *is* the token, so
   * the host is the part that can safely appear in a screenshot.
   */
  host: string;
  /** "Canvas", "When I Work", "Calendar from someclub.org". */
  label: string;
  /** What fetching it produces, which decides how a refresh applies it. */
  kind: 'assignments' | 'events';
  /** Matches `FixedEvent.source` for event feeds. Null for Canvas. */
  sourceKey: string | null;
  rememberedAt: string;
  /** When it was last fetched successfully, here or on another device. Drives the daily refresh. */
  fetchedAt: string | null;
  /**
   * The account has confirmed holding it. What tells "forgotten on another
   * device" apart from "saved here before signing in" (`feed-sync-rule.ts`).
   */
  synced: boolean;
}

/** What changed, for whoever mirrors this store to the account. */
export type FeedChange =
  | { op: 'upsert'; feed: RememberedFeed }
  | { op: 'touch'; url: string; fetchedAt: string }
  | { op: 'delete'; url: string };

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'your calendar';
  }
}

function clean(v: Partial<RememberedFeed>): RememberedFeed | null {
  if (typeof v?.url !== 'string' || !v.url) return null;
  return {
    url: v.url,
    host: typeof v.host === 'string' && v.host ? v.host : hostOf(v.url),
    label: typeof v.label === 'string' && v.label ? v.label : 'Canvas',
    kind: v.kind === 'events' ? 'events' : 'assignments',
    sourceKey: typeof v.sourceKey === 'string' ? v.sourceKey : null,
    rememberedAt: typeof v.rememberedAt === 'string' ? v.rememberedAt : new Date().toISOString(),
    fetchedAt: typeof v.fetchedAt === 'string' ? v.fetchedAt : null,
    synced: v.synced === true,
  };
}

/** Read straight from storage, migrating the old Canvas-only slot on the way. Exported for tests. */
export function readFeeds(): RememberedFeed[] {
  return load();
}

function load(): RememberedFeed[] {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.map(clean).filter((f): f is RememberedFeed => f !== null) : EMPTY;
    }
    // One-time move from the Canvas-only slot, so nobody who ticked the box
    // before this change finds their link forgotten.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const one = clean({ ...JSON.parse(legacy), label: 'Canvas', kind: 'assignments' });
      const list = one ? [one] : EMPTY;
      window.localStorage.setItem(KEY, JSON.stringify(list));
      window.localStorage.removeItem(LEGACY_KEY);
      return list;
    }
  } catch {
    // Corrupt storage reads as nothing remembered, never as a crash.
  }
  return EMPTY;
}

/** One frozen empty list, so an empty snapshot is always the same reference. */
const EMPTY: RememberedFeed[] = Object.freeze([]) as unknown as RememberedFeed[];

let cache: RememberedFeed[] | undefined;
const listeners = new Set<() => void>();
let mirror: ((changes: FeedChange[]) => void) | null = null;

function report(changes: FeedChange[]): void {
  if (mirror && changes.length) mirror(changes);
}

function save(list: RememberedFeed[]): void {
  cache = list.length ? list : EMPTY;
  if (typeof window !== 'undefined') {
    try {
      if (list.length) window.localStorage.setItem(KEY, JSON.stringify(list));
      else window.localStorage.removeItem(KEY);
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Storage full or disabled. Not remembering is the safe failure.
    }
  }
  for (const l of listeners) l();
}

/**
 * Shaped for `useSyncExternalStore`, like `heronStore`, and for the same
 * reason: read in an effect instead and every consumer renders once saying
 * "nothing remembered" before correcting itself.
 */
export const feedStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      // Forgetting a link in another tab has to take effect in this one. A link
      // the student believes they revoked, still live behind a stale render, is
      // the worst possible shape for this particular bug.
      if (e.key === KEY || e.key === LEGACY_KEY) {
        cache = undefined;
        for (const l of listeners) l();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },

  getSnapshot(): RememberedFeed[] {
    if (cache === undefined) cache = load();
    return cache;
  },

  /** Always empty on the server, so the first client pass never claims a link exists. */
  getServerSnapshot(): RememberedFeed[] {
    return EMPTY;
  },

  /** The remembered Canvas link, if there is one. */
  canvas(): RememberedFeed | null {
    return this.getSnapshot().find((f) => f.kind === 'assignments') ?? null;
  },

  /**
   * Remember a link, replacing any entry for the same calendar.
   *
   * "Same calendar" is the same URL, or for Canvas any Canvas link: a student
   * has one Canvas feed, and pasting a new one after a reset replaces the dead
   * one rather than leaving it failing daily beside it.
   */
  remember(entry: { url: string; label: string; kind: 'assignments' | 'events'; sourceKey: string | null }): void {
    const now = new Date().toISOString();
    const next: RememberedFeed = {
      url: entry.url, host: hostOf(entry.url), label: entry.label, kind: entry.kind,
      sourceKey: entry.sourceKey, rememberedAt: now, fetchedAt: now, synced: false,
    };
    const list = this.getSnapshot();
    const rest = list.filter((f) => !sameCalendar(f, next));
    save([...rest, next]);
    // The replaced links go on every device too, or the account would keep a
    // dead Canvas link and hand it back to the next device that signs in.
    report([
      ...list.filter((f) => sameCalendar(f, next) && f.url !== next.url).map((f) => ({ op: 'delete' as const, url: f.url })),
      { op: 'upsert', feed: next },
    ]);
  },

  markFetched(url: string, at: string): void {
    const list = this.getSnapshot();
    if (!list.some((f) => f.url === url)) return;
    save(list.map((f) => (f.url === url ? { ...f, fetchedAt: at } : f)));
    report([{ op: 'touch', url, fetchedAt: at }]);
  },

  /** Forget one link, by its URL, here and on the account. */
  forget(url: string): void {
    save(this.getSnapshot().filter((f) => f.url !== url));
    report([{ op: 'delete', url }]);
  },

  /** Forget every link. What Delete my data calls. */
  forgetAll(): void {
    const list = this.getSnapshot();
    save([]);
    report(list.map((f) => ({ op: 'delete' as const, url: f.url })));
  },

  /**
   * Mirror every later change to the account, or stop with null. Only
   * `feed-sync.ts` calls this; signed out there is no mirror and nothing leaves.
   */
  setMirror(fn: ((changes: FeedChange[]) => void) | null): void {
    mirror = fn;
  },

  /** Put the reconciled list in place. Not reported: it came from the account. */
  replaceAll(list: RememberedFeed[]): void {
    save(list);
  },

  /** The account confirmed it holds these. */
  markSynced(urls: string[]): void {
    const list = this.getSnapshot();
    if (!list.some((f) => urls.includes(f.url) && !f.synced)) return;
    save(list.map((f) => (urls.includes(f.url) ? { ...f, synced: true } : f)));
  },
};
