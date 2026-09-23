'use client';

import { supabase } from './client';
import { feedStore, type FeedChange, type RememberedFeed } from '@/lib/feed-store';
import { reconcileFeeds } from '@/lib/feed-sync-rule';

/**
 * Keeping remembered calendar links the same on every signed-in device.
 *
 * On sign-in: send any forget that failed last time, read the account's links,
 * reconcile them with this device's (`feed-sync-rule.ts` has the rules), and
 * upload what the account has never seen. After that, every change `feedStore`
 * reports goes to `/api/feeds` as it happens.
 *
 * Every failure is silent and leaves the device copy working, like the plan's
 * sync: a student's week has never depended on a network. The one failure that
 * is not left to chance is a forget. A link the student revoked must not come
 * back from the account because the delete hit a dead network, so a failed
 * forget is kept on this device and sent again at the next sign-in, before
 * anything is read.
 */

const PENDING = 'heron.feeds.pending-forget.v1';

async function token(): Promise<string | null> {
  const client = supabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

async function send(changes: FeedChange[]): Promise<{ ok: boolean; synced: string[] }> {
  const t = await token();
  if (!t) return { ok: false, synced: [] };
  try {
    const res = await fetch('/api/feeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` },
      body: JSON.stringify({ changes }),
    });
    if (!res.ok) return { ok: false, synced: [] };
    const body = await res.json();
    return { ok: true, synced: Array.isArray(body.synced) ? body.synced : [] };
  } catch {
    return { ok: false, synced: [] };
  }
}

function pending(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(PENDING) ?? '[]');
    return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

function setPending(urls: string[]): void {
  try {
    if (urls.length) window.localStorage.setItem(PENDING, JSON.stringify([...new Set(urls)]));
    else window.localStorage.removeItem(PENDING);
  } catch {
    // Storage off: the forget is still gone from this device.
  }
}

async function mirror(changes: FeedChange[]): Promise<void> {
  // No session means signed out, or an account that was just deleted, which
  // takes its rows with it. Either way there is nothing to tell.
  if (!(await token())) return;
  const result = await send(changes);
  if (result.ok) {
    feedStore.markSynced(result.synced);
    return;
  }
  const forgets = changes.filter((c) => c.op === 'delete').map((c) => c.url);
  if (forgets.length) setPending([...pending(), ...forgets]);
  // A failed upsert needs nothing: it stays `synced: false` and the next
  // sign-in uploads it.
}

/** Start keeping links in step for this account. Returns a stop function. */
export function startFeedSync(): () => void {
  let stopped = false;

  void (async () => {
    const t = await token();
    if (!t || stopped) return;

    const owed = pending();
    if (owed.length) {
      const r = await send(owed.map((url) => ({ op: 'delete', url })));
      if (!r.ok) return;   // Reading the account now could bring them back.
      setPending([]);
    }

    let remote: RememberedFeed[];
    try {
      const res = await fetch('/api/feeds', { headers: { authorization: `Bearer ${t}` } });
      // 503 is a build without FEED_LINK_KEY: links stay on the device.
      if (!res.ok) return;
      remote = (await res.json()).feeds ?? [];
    } catch {
      return;
    }
    if (stopped) return;

    const { list, upload, remove } = reconcileFeeds(feedStore.getSnapshot(), remote);
    feedStore.replaceAll(list);
    feedStore.setMirror((changes) => { void mirror(changes); });

    const changes: FeedChange[] = [
      ...remove.map((url) => ({ op: 'delete' as const, url })),
      ...upload.map((feed) => ({ op: 'upsert' as const, feed })),
    ];
    if (changes.length) await mirror(changes);
  })();

  return () => {
    stopped = true;
    feedStore.setMirror(null);
  };
}
