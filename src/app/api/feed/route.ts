/**
 * POST /api/feed  →  assignments (Canvas) or fixed events (any other calendar)
 *
 * The browser cannot fetch these directly: none of the providers send CORS
 * headers, so the request dies before it starts. This route does the fetch
 * server-side and returns parsed JSON.
 *
 * The feed URL is a bearer credential. Anyone holding it can read a student's
 * entire schedule, forever, with no login. So this route:
 *   - never logs it
 *   - never stores it
 *   - only accepts hosts that actually look like Canvas
 *   - refuses private and link-local addresses, so it can't be used to probe
 *     the internal network it runs inside
 *
 * That last one is the important one. An endpoint that fetches a user-supplied
 * URL server-side is an SSRF primitive unless it is explicitly not.
 */

import { NextResponse } from 'next/server';
import { looksLikeCalendar } from '@/lib/canvas/ics';
import { assignmentsFromICS, coursesFrom, workloadByWeek } from '@/lib/canvas/interpret';
import { validateFeedUrl } from '@/lib/canvas/feed-url';
import { identifySource } from '@/lib/calendar/sources';
import { eventsFromICS } from '@/lib/calendar/import';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';
/** Never cached: the response is derived from a per-user credential. */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export interface FeedError { error: string; hint?: string }

export async function POST(request: Request) {
  let raw: unknown;
  try {
    ({ url: raw } = await request.json());
  } catch {
    return NextResponse.json<FeedError>({ error: 'Expected JSON with a "url" field.' }, { status: 400 });
  }

  const checked = validateFeedUrl(raw);
  if (!checked.ok) {
    return NextResponse.json<FeedError>({ error: checked.error, hint: checked.hint }, { status: 400 });
  }
  const url = checked.url;
  const provider = identifySource(url.hostname)?.label ?? 'That calendar';

  let text: string;
  try {
    const res = await fetch(url, {
      redirect: 'error',              // a redirect off Canvas would defeat the allowlist
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'text/calendar, text/plain' },
    });

    if (!res.ok) {
      return NextResponse.json<FeedError>({
        error: `${provider} returned ${res.status}.`,
        hint: res.status === 404 || res.status === 400
          ? 'That usually means the page address got copied instead of the iCal or ICS link.'
          : `Try copying the link from ${provider} again.`,
      }, { status: 502 });
    }

    const length = Number(res.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
      return NextResponse.json<FeedError>({ error: 'That feed is unexpectedly large.' }, { status: 413 });
    }

    text = await res.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json<FeedError>({ error: 'That feed is unexpectedly large.' }, { status: 413 });
    }
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    return NextResponse.json<FeedError>({
      error: timedOut ? `${provider} took too long to respond.` : `Couldn't reach ${provider}.`,
      hint: 'Check the link, then try again.',
    }, { status: 504 });
  }

  if (!looksLikeCalendar(text)) {
    return NextResponse.json<FeedError>({
      error: 'That link returned a web page, not a calendar.',
      hint: 'Look for the iCal or ICS address rather than the one in your browser bar.',
    }, { status: 422 });
  }

  // Where the feed came from decides what its contents mean. Canvas carries
  // work with deadlines; a personal calendar carries time already spoken for.
  const source = identifySource(url.hostname);

  if (source?.produces === 'events') {
    const { events, skippedRecurring } = eventsFromICS(text, {
      tz: 'America/Los_Angeles',
      from: new Date(),
      days: 60,
    });
    return NextResponse.json({
      kind: 'events' as const,
      source: source.label,
      events,
      skippedRecurring,
      fetchedAt: new Date().toISOString(),
    });
  }

  const assignments = assignmentsFromICS(text);
  return NextResponse.json({
    kind: 'assignments' as const,
    source: source?.label ?? 'Canvas',
    assignments,
    courses: coursesFrom(assignments),
    workload: workloadByWeek(assignments),
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * GET /api/feed  →  the same shape, from a synthetic quarter.
 *
 * Demo mode exists so a student can see what the product does *before* handing
 * over a URL that grants read access to their real schedule. Asking for a
 * credential up front, sight unseen, is a bad trade to offer someone.
 *
 * The fixture is read from disk at request time, so next.config.ts has to
 * include it in the serverless bundle (outputFileTracingIncludes).
 */
export async function GET() {
  const path = join(process.cwd(), 'fixtures', 'sample-feed-midquarter.ics');

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return NextResponse.json<FeedError>({ error: 'Sample data is unavailable.' }, { status: 500 });
  }

  const assignments = assignmentsFromICS(text);
  return NextResponse.json({
    assignments,
    courses: coursesFrom(assignments),
    workload: workloadByWeek(assignments),
    kind: 'assignments' as const,
    source: 'Canvas',
    fetchedAt: new Date().toISOString(),
    demo: true,
  });
}
