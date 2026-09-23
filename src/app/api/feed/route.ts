/**
 * POST /api/feed  →  assignments (Canvas) or fixed events (any other calendar)
 *
 * The browser cannot fetch these directly: almost no calendar provider sends
 * CORS headers, so the request dies before it starts. This route does the fetch
 * server-side and returns parsed JSON.
 *
 * The feed URL is a bearer credential. Anyone holding it can read a student's
 * whole schedule, forever, with no login. So this route:
 *   - never logs it
 *   - never stores it
 *   - never connects to a private, loopback or link-local address, checked on
 *     the resolved address itself and on every redirect (`fetch-feed.ts`)
 *
 * That last one is the important one. An endpoint that fetches a user-supplied
 * URL server-side is an SSRF primitive unless it is explicitly not. It used to
 * be made safe by an allowlist of four providers; it is now made safe by the
 * address, which is what the allowlist was standing in for, and which lets a
 * student import a work schedule from whatever app their employer picked.
 */

import { NextResponse } from 'next/server';
import { calendarName, looksLikeCalendar } from '@/lib/canvas/ics';
import { assignmentsFromICS, coursesFrom, workloadByWeek } from '@/lib/canvas/interpret';
import { validateFeedUrl } from '@/lib/canvas/feed-url';
import { describeSource } from '@/lib/calendar/sources';
import { eventsFromICS } from '@/lib/calendar/import';
import { fetchCalendar } from './fetch-feed';
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
  // Named from the host the student pasted, not wherever it redirected to, so
  // an iCloud link that bounces between Apple servers is still "Apple".
  const provider = describeSource(url.hostname).label;
  const named = provider.startsWith('Calendar from') ? 'That site' : provider;

  const got = await fetchCalendar(url, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES });
  if (!got.ok) {
    switch (got.reason) {
      case 'status':
        return NextResponse.json<FeedError>({
          error: `${named} returned ${got.status}.`,
          hint: got.status === 404 || got.status === 400 || got.status === 401 || got.status === 403
            ? 'That usually means the page address got copied instead of the calendar link, or the link was reset.'
            : `Try copying the link from ${named} again.`,
        }, { status: 502 });
      case 'too-large':
        return NextResponse.json<FeedError>({ error: 'That calendar is unexpectedly large.' }, { status: 413 });
      case 'timeout':
        return NextResponse.json<FeedError>({
          error: `${named} took too long to respond.`, hint: 'Check the link, then try again.',
        }, { status: 504 });
      case 'blocked':
        return NextResponse.json<FeedError>({
          error: "That link leads to a private address, so it wasn't fetched.",
          hint: 'Calendar links come from a public site: your school, Google, iCloud, Outlook, or your work scheduling app.',
        }, { status: 400 });
      case 'redirects':
        return NextResponse.json<FeedError>({ error: 'That link redirected too many times.' }, { status: 502 });
      default:
        return NextResponse.json<FeedError>({
          error: `Couldn't reach ${named === 'That site' ? 'that site' : named}.`,
          hint: 'Check the link, then try again.',
        }, { status: 504 });
    }
  }

  const text = got.text;
  if (!looksLikeCalendar(text)) {
    return NextResponse.json<FeedError>({
      error: 'That link returned a web page, not a calendar.',
      hint: 'Look for the iCal or ICS address rather than the one in your browser bar.',
    }, { status: 422 });
  }

  // Where the feed came from decides what its contents mean, with Canvas also
  // recognised by its own signature on domains no rule knows.
  const source = describeSource(url.hostname, text);

  // A calendar can be malformed in ways nobody predicted, and one bad line must
  // be a readable error, never a bare 500. That is what an Outlook calendar got
  // until its time zone names were understood.
  try {
    if (source.produces === 'events') {
      const { events, skippedRecurring } = eventsFromICS(text, {
        tz: 'America/Los_Angeles',
        from: new Date(),
        days: 60,
        category: source.category,
      });
      // Host and calendar name, never the path: this travels into synced state.
      const sourceKey = `${url.hostname}#${calendarName(text) ?? ''}`;
      return NextResponse.json({
        kind: 'events' as const,
        source: source.label,
        sourceKind: source.kind,
        sourceKey,
        events: events.map((e) => ({ ...e, source: sourceKey })),
        skippedRecurring,
        fetchedAt: new Date().toISOString(),
      });
    }

    const assignments = assignmentsFromICS(text);
    return NextResponse.json({
      kind: 'assignments' as const,
      source: source.label,
      sourceKind: source.kind,
      assignments,
      courses: coursesFrom(assignments),
      workload: workloadByWeek(assignments),
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json<FeedError>({
      error: "That calendar loaded but couldn't be read.",
      hint: 'If it is from an app not listed below, the exported .ics file may work where the link does not.',
    }, { status: 422 });
  }
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
