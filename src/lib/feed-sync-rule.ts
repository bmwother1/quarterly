/**
 * Which calendar links a device keeps after seeing the account's copy.
 *
 * Pure, so the rules can be tested without a network. `src/supabase/feed-sync.ts`
 * does the fetching and applies what this returns.
 *
 * The rule that matters is the one about deletion. A link can disappear from
 * the account for two reasons: another device forgot it, or this device
 * remembered it while signed out and the account has never seen it. Those look
 * identical in the two lists and need opposite answers, so every entry carries
 * `synced`: true once the account has confirmed holding it. Missing from the
 * account and synced means forgotten elsewhere, so it goes. Missing and never
 * synced means new here, so it is uploaded. Get that backwards and either a link
 * the student revoked on their laptop comes back from their phone, or a link
 * they saved before signing in silently vanishes.
 */

import type { RememberedFeed } from './feed-store.ts';

/**
 * Two entries describe the same calendar.
 *
 * Same URL, or both Canvas (a student has one Canvas feed; a reset link replaces
 * the dead one), or the same imported calendar.
 */
export function sameCalendar(a: RememberedFeed, b: RememberedFeed): boolean {
  return a.url === b.url
    || (a.kind === 'assignments' && b.kind === 'assignments')
    || (a.sourceKey !== null && a.sourceKey === b.sourceKey);
}

export interface Reconciled {
  /** What this device should hold afterwards. */
  list: RememberedFeed[];
  /** Local links the account has never seen. */
  upload: RememberedFeed[];
  /** Account links a newer local one replaces. */
  remove: string[];
}

export function reconcileFeeds(local: RememberedFeed[], remote: RememberedFeed[]): Reconciled {
  const remoteUrls = new Set(remote.map((f) => f.url));
  const fresh = local.filter((f) => !f.synced && !remoteUrls.has(f.url));

  // Remote entries, with this device's later fetch time kept: the account copy
  // only hears about a fetch when a push succeeds.
  const kept = remote.map((r) => {
    const mine = local.find((l) => l.url === r.url);
    const fetchedAt = latest(r.fetchedAt, mine?.fetchedAt ?? null);
    return { ...r, fetchedAt, synced: true };
  });

  // A link saved here while signed out can collide with the account's (a Canvas
  // link reset on the phone, say). The newer one wins, like `remember` does.
  const upload: RememberedFeed[] = [];
  const remove: string[] = [];
  let list = kept;
  for (const f of fresh) {
    const clash = list.filter((k) => sameCalendar(k, f));
    if (clash.some((k) => k.rememberedAt > f.rememberedAt)) continue;
    for (const k of clash) if (k.synced) remove.push(k.url);
    list = [...list.filter((k) => !sameCalendar(k, f)), f];
    upload.push(f);
  }

  return { list, upload, remove };
}

function latest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
