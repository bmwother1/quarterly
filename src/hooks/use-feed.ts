'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useHeron } from './use-heron';
import { feedStore, type RememberedFeed } from '@/lib/feed-store';
import { applyCanvas, describeMerge } from '@/lib/canvas/merge';
import { replaceSourceEvents } from '@/lib/calendar/import';
import { collisionsWith } from '@/lib/schedule/conflicts';
import { fitNewWork } from '@/lib/schedule/fit-new';
import { logEvent } from '@/supabase/events';
import type { Assignment, FixedEvent } from '@/lib/types';

/**
 * Fetching remembered calendars again, by hand or once a day on their own.
 *
 * **Fetching data and changing the plan are separate decisions.** The first
 * version of this refused to fetch on its own, on the grounds that a plan should
 * never change unasked. That conflated two things. New deadlines and a new work
 * schedule are information the student needs daily: plenty of instructors post
 * work the week it is due, and managers publish next week's shifts on Friday.
 * What must never happen unasked is the week they already looked at
 * rearranging itself. So:
 *
 *   Canvas   → merge, then fit only the new work into free time (`fitNewWork`).
 *   Calendars→ replace that calendar's events, then *report* any study block a
 *              new shift now lands on. Moving it is the student's call, one tap.
 *
 * A full rebuild stays behind "Replan from now".
 */

export interface CalendarChange {
  label: string;
  added: number;
  removed: number;
}

export type RefreshResult = {
  /** Canvas outcome, when a Canvas link is remembered and the fetch worked. */
  canvas: { summary: string; placed: Assignment[]; short: Assignment[] } | null;
  /** Other calendars that actually changed. */
  calendars: CalendarChange[];
  /** Future study blocks a refreshed calendar now overlaps. */
  clashes: number;
  failures: Array<{ label: string; error: string; hint?: string }>;
};

/** Worth a banner: something changed, or something failed on a tap. */
export function isNews(r: RefreshResult): boolean {
  return (r.canvas !== null && (r.canvas.summary !== 'Nothing new' || r.canvas.placed.length > 0 || r.canvas.short.length > 0))
    || r.calendars.length > 0
    || r.clashes > 0;
}

/** The whole refresh in a sentence or two, for places without room for a card. */
export function describeRefresh(r: RefreshResult): string {
  const parts: string[] = [];
  if (r.canvas && r.canvas.summary !== 'Nothing new') {
    parts.push(`Canvas: ${r.canvas.summary}${r.canvas.placed.length ? `, ${r.canvas.placed.length} added to your week` : ''}${r.canvas.short.length ? `, ${r.canvas.short.length} didn't fit` : ''}.`);
  }
  for (const c of r.calendars) {
    parts.push(`${c.label}: ${[c.added && `${c.added} new`, c.removed && `${c.removed} removed`].filter(Boolean).join(', ')}.`);
  }
  if (r.clashes) parts.push(`${r.clashes} study block${r.clashes === 1 ? '' : 's'} now overlap something new; replan to fix.`);
  for (const f of r.failures) parts.push(`${f.label}: ${f.error}${f.hint ? ` ${f.hint}` : ''}`);
  if (parts.length === 0) return 'Everything is up to date. Nothing already planned was moved.';
  return parts.join(' ');
}

/**
 * One automatic attempt per page load. A failing link must not become a retry
 * loop against someone's server on every render, and two open tabs should not
 * fetch twice.
 */
let autoAttempted = false;

async function fetchFeed(feed: RememberedFeed): Promise<
  | { ok: true; body: { kind: 'assignments'; assignments: Assignment[] } | { kind: 'events'; events: FixedEvent[]; sourceKey: string } }
  | { ok: false; error: string; hint?: string }
> {
  try {
    const res = await fetch('/api/feed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: feed.url }),
    });
    const body = await res.json();
    if (!res.ok) {
      // Providers hand out a new link whenever a student resets theirs, and the
      // old one then fails forever. Saying so beats a generic failure, because
      // the fix is "paste the new one", not "try again".
      const stale = res.status === 502 || res.status === 422;
      return {
        ok: false,
        error: body.error ?? `Could not reach ${feed.label}.`,
        hint: stale ? `${feed.label} may have reset the link. Paste the current one on the import page and it replaces this one.` : body.hint,
      };
    }
    return { ok: true, body };
  } catch {
    return { ok: false, error: 'Could not reach the server.', hint: 'Check your connection and try again.' };
  }
}

export function useFeed(tz: string) {
  const { state, mutate } = useHeron(tz);
  const remembered = useSyncExternalStore(
    feedStore.subscribe,
    feedStore.getSnapshot,
    feedStore.getServerSnapshot,
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (how: 'tap' | 'daily' = 'tap'): Promise<RefreshResult> => {
    const feeds = feedStore.getSnapshot();
    const empty: RefreshResult = { canvas: null, calendars: [], clashes: 0, failures: [] };
    if (feeds.length === 0) return empty;
    if (how === 'daily') {
      if (autoAttempted) return empty;
      autoAttempted = true;
    }

    setBusy(true);
    try {
      // Fetched in parallel, applied in one update, so a student never sees a
      // half-refreshed week between two calendars landing.
      const fetched = await Promise.all(feeds.map(async (f) => ({ feed: f, got: await fetchFeed(f) })));
      const result: RefreshResult = { ...empty, calendars: [], failures: [] };
      const now = new Date();
      const at = now.toISOString();
      const fetchedOk: string[] = [];

      mutate((prev) => {
        let next = prev;
        const newEvents: FixedEvent[] = [];

        for (const { feed, got } of fetched) {
          if (!got.ok) {
            result.failures.push({ label: feed.label, error: got.error, hint: got.hint });
            continue;
          }
          const body = got.body;

          if (feed.kind === 'assignments') {
            if (body.kind !== 'assignments') {
              result.failures.push({ label: feed.label, error: 'That remembered link is no longer a Canvas feed.' });
              continue;
            }
            const { next: merged, merge } = applyCanvas(next, body.assignments, at);
            const fit = fitNewWork(merged, merge, now, tz);
            next = fit.next;
            result.canvas = { summary: describeMerge(merge) ?? 'Nothing new', placed: fit.placed, short: fit.short };
            logEvent('feed_refreshed', {
              added: merge.added, updated: merge.updated, removed: merge.removed,
              placed: fit.placed.length, short: fit.short.length, daily: how === 'daily', canvas: true,
            });
          } else {
            if (body.kind !== 'events') continue;
            const key = feed.sourceKey ?? body.sourceKey;
            const before = new Set(next.events.filter((e) => e.source === key).map((e) => e.id));
            const events = replaceSourceEvents(next.events, key, body.events);
            const after = new Set(body.events.map((e) => e.id));
            const added = [...after].filter((id) => !before.has(id)).length;
            const removed = [...before].filter((id) => !after.has(id)).length;
            if (added || removed) {
              result.calendars.push({ label: feed.label, added, removed });
              newEvents.push(...body.events.filter((e) => !before.has(e.id)));
            }
            next = { ...next, events };
            logEvent('feed_refreshed', { added, removed, daily: how === 'daily', canvas: false });
          }
          fetchedOk.push(feed.url);
        }

        // Only future blocks, and only against events that just arrived: a clash
        // the student already saw and left alone is theirs, not news.
        result.clashes = new Set(
          collisionsWith(next.blocks.filter((b) => Date.parse(b.start) > now.getTime()), newEvents)
            .map((c) => c.block.id),
        ).size;

        return next;
      });

      // Outside the updater, which must stay a pure function of state.
      for (const url of fetchedOk) feedStore.markFetched(url, at);
      return result;
    } finally {
      setBusy(false);
    }
  }, [mutate, tz]);

  const remember = useCallback(
    (entry: { url: string; label: string; kind: 'assignments' | 'events'; sourceKey: string | null }) => feedStore.remember(entry),
    [],
  );
  const forget = useCallback((url: string) => feedStore.forget(url), []);

  return {
    remembered,
    canvasRemembered: remembered.some((f) => f.kind === 'assignments'),
    /** The Canvas fetch timestamp, so callers don't need a second hook for it. */
    canvasSyncedAt: state.canvasSyncedAt ?? null,
    hasCourses: state.courses.length > 0,
    busy,
    refresh,
    remember,
    forget,
  };
}
