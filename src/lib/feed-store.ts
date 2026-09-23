/**
 * Calendar links, remembered on this device and nowhere else.
 *
 * **Why this is a separate store rather than a field on `HeronState`.** That
 * object is the sync payload: `push()` writes it wholesale into `plan_state`,
 * and `toBackup()` writes it into a JSON file in someone's Downloads folder. A
 * feed URL added there would be on the server within two seconds of being
 * typed, and the claim the product leads with (that Heron never holds your
 * calendar credentials) would have become false by accident rather than by
 * decision. Keeping them out of that object is what makes the claim structural
 * instead of a promise somebody has to remember.
 *
 * So: its own key, never merged into `HeronState`, never read by `sync.ts`,
 * never written by `backup.ts`. The only way a link leaves this browser is a
 * fetch of that calendar, which is the same round trip the original paste made,
 * and `/api/feed` neither logs nor stores it.
 *
 * **One entry per calendar, not one slot.** It started as a single Canvas slot.
 * Work schedules change weekly too, and a student with Canvas, a work app and a
 * club calendar has three links that all go stale the same way.
 *
 * **Opt-in per link, and reversible in one tap.** Nothing is remembered unless
 * the student ticks the box; each link can be forgotten on its own from the
 * import page or Settings, and Delete my data forgets them all. See
 * `context/decisions.md`, 2026-09-22.
 *
 * The residual risk is honest and worth stating: anything that can run script
 * on this origin can read this key. That is already true of the student's whole
 * schedule sitting next door in `quarterly.state.v1`, and Heron loads no
 * third-party script, so remembering links widens the damage an XSS could do
 * rather than creating a new way in.
 */

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
  /** When this device last fetched it successfully. Drives the daily refresh. */
  fetchedAt: string | null;
}

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
      sourceKey: entry.sourceKey, rememberedAt: now, fetchedAt: now,
    };
    const rest = this.getSnapshot().filter((f) =>
      f.url !== entry.url
      && !(entry.kind === 'assignments' && f.kind === 'assignments')
      && !(entry.sourceKey && f.sourceKey === entry.sourceKey));
    save([...rest, next]);
  },

  markFetched(url: string, at: string): void {
    const list = this.getSnapshot();
    if (!list.some((f) => f.url === url)) return;
    save(list.map((f) => (f.url === url ? { ...f, fetchedAt: at } : f)));
  },

  /** Forget one link, by its URL. */
  forget(url: string): void {
    save(this.getSnapshot().filter((f) => f.url !== url));
  },

  /** Forget every link. What Delete my data calls. */
  forgetAll(): void {
    save([]);
  },
};
