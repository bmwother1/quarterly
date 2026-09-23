/**
 * GET  /api/feeds  →  this student's remembered calendar links
 * POST /api/feeds  →  apply changes from `feedStore` (remember, fetched, forget)
 *
 * Why a route and not the browser writing the table directly, the way the plan
 * syncs: the link has to be encrypted with a key the browser never sees
 * (`seal.ts`). Everything else about access is the database's job. The route
 * talks to Supabase *as the student*, with their own token, so row-level
 * security decides which rows it can reach, exactly as it does for the plan.
 * There is no service-role key in this file.
 *
 * Like `/api/feed`, it never logs a link, and it never returns one to anybody
 * but the account that saved it.
 */

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateFeedUrl } from '@/lib/canvas/feed-url';
import { hostOf, type FeedChange, type RememberedFeed } from '@/lib/feed-store';
import { keysFrom, linkId, seal, unseal, type Keys } from './seal';

export const runtime = 'nodejs';
/** Never cached: the response is a student's credentials. */
export const dynamic = 'force-dynamic';

/** More than any real student has; stops the route being a free encryption oracle. */
const MAX_CHANGES = 25;

interface Row {
  sealed: string;
  host: string;
  label: string;
  kind: 'assignments' | 'events';
  source_key: string | null;
  remembered_at: string;
  fetched_at: string | null;
}

type Ctx = { db: SupabaseClient; userId: string; keys: Keys };

/**
 * The student behind the request, or the response to send instead.
 *
 * 503 for a missing key is deliberate: the client reads it as "this build does
 * not sync links" and keeps them on the device, the same as signed out.
 */
async function context(request: Request): Promise<Ctx | NextResponse> {
  const keys = keysFrom(process.env.FEED_LINK_KEY);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!keys || !url || !anon) {
    return NextResponse.json({ error: 'Link sync is not configured.' }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const db = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  return { db, userId: data.user.id, keys };
}

export async function GET(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.db
    .from('calendar_feed')
    .select('sealed, host, label, kind, source_key, remembered_at, fetched_at')
    .eq('user_id', ctx.userId);
  if (error) return NextResponse.json({ error: 'Could not read your calendar links.' }, { status: 500 });

  const feeds: RememberedFeed[] = [];
  for (const r of (data ?? []) as Row[]) {
    // A row that will not open (key rotated, row tampered with) is skipped
    // rather than failing the whole list: the student pastes that one again.
    const url = unseal(ctx.keys, ctx.userId, r.sealed);
    if (!url) continue;
    feeds.push({
      url, host: r.host, label: r.label, kind: r.kind, sourceKey: r.source_key,
      rememberedAt: r.remembered_at, fetchedAt: r.fetched_at, synced: true,
    });
  }
  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;

  let changes: FeedChange[];
  try {
    ({ changes } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Expected JSON with a "changes" list.' }, { status: 400 });
  }
  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) {
    return NextResponse.json({ error: 'Expected a short "changes" list.' }, { status: 400 });
  }

  const { db, userId, keys } = ctx;
  const synced: string[] = [];

  // In order: `remember` sends the delete of a replaced link before the new one.
  for (const c of changes) {
    if (c?.op === 'upsert') {
      const f = c.feed;
      if (!f || !validateFeedUrl(f.url).ok) continue;
      const { error } = await db.from('calendar_feed').upsert({
        user_id: userId,
        link_id: linkId(keys, userId, f.url),
        sealed: seal(keys, userId, f.url),
        host: hostOf(f.url),
        label: String(f.label ?? 'Canvas').slice(0, 120),
        kind: f.kind === 'events' ? 'events' : 'assignments',
        source_key: typeof f.sourceKey === 'string' ? f.sourceKey.slice(0, 300) : null,
        remembered_at: validInstant(f.rememberedAt) ?? new Date().toISOString(),
        fetched_at: validInstant(f.fetchedAt),
      }, { onConflict: 'user_id,link_id' });
      if (!error) synced.push(f.url);
    } else if (c?.op === 'touch') {
      const at = validInstant(c.fetchedAt);
      if (typeof c.url !== 'string' || !at) continue;
      // Update only. A fetch on a device that has not heard the link was
      // forgotten elsewhere must not bring it back.
      await db.from('calendar_feed')
        .update({ fetched_at: at })
        .eq('user_id', userId)
        .eq('link_id', linkId(keys, userId, c.url));
    } else if (c?.op === 'delete') {
      if (typeof c.url !== 'string') continue;
      await db.from('calendar_feed')
        .delete()
        .eq('user_id', userId)
        .eq('link_id', linkId(keys, userId, c.url));
    }
  }

  return NextResponse.json({ synced });
}

function validInstant(v: unknown): string | null {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
}
