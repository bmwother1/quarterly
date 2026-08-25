'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { logEvent } from '@/supabase/events';
import { eventsFromICS } from '@/lib/calendar/import';
import { looksLikeCalendar } from '@/lib/canvas/ics';
import { WorkloadChart, CourseList } from '@/components/workload-chart';
import { SOURCE_HELP } from '@/lib/calendar/sources';
import { DEFAULT_TZ, fmtDay, fmtTime } from '@/lib/time';
import type { Assignment, Course, FixedEvent } from '@/lib/types';

const TZ = DEFAULT_TZ;

type Result =
  | { kind: 'assignments'; source: string; assignments: Assignment[]; courses: Course[]; workload: Array<{ weekStart: string; count: number; minutes: number; hasExam: boolean }>; demo?: boolean }
  | { kind: 'events'; source: string; events: FixedEvent[]; skippedRecurring: number };

/**
 * One box for every calendar a student has.
 *
 * The same paste works for Canvas, Google, Apple and Outlook — the server
 * decides what the contents mean from where they came from, so there's nothing
 * to choose here. Fewer decisions is the entire point of a one-stop import.
 */
export default function ImportPage() {
  const { state, mutate, replan } = useQuarterly(TZ);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ error: string; hint?: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [imported, setImported] = useState<string | null>(null);

  /**
   * Import a .ics file the student exported themselves.
   *
   * **Why this exists.** The link path is genuinely hard for Apple Calendar: it
   * means publishing your calendar as a public feed, which is buried in the
   * share settings, only works for iCloud calendars, and asks a student to make
   * their schedule world-readable to get it into an app. File then Export is two
   * clicks and exposes nothing.
   *
   * **Parsed in the browser, not sent anywhere.** The parser is dependency-free
   * domain code, so a file never leaves the device. That also sidesteps the
   * host allowlist entirely, since there is no host: the whole reason that
   * allowlist exists is that a feed URL is a bearer credential for someone's
   * whole schedule, and a file is not.
   *
   * **A file always becomes fixed events to schedule around, never assignments.**
   * The server decides between the two from the feed's hostname, and a file has
   * no hostname. Guessing from the contents would be wrong sometimes, and
   * silently turning someone's work shifts into coursework is worse than asking
   * Canvas users to paste their link.
   */
  async function importFile(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    setImported(null);
    try {
      const text = await file.text();
      if (!looksLikeCalendar(text)) {
        setError({
          error: "That file doesn't look like a calendar.",
          hint: 'It needs to be a .ics file, exported from Calendar with File then Export.',
        });
        return;
      }

      const { events, skippedRecurring } = eventsFromICS(text, {
        tz: TZ,
        from: new Date(),
        days: 60,
      });

      setResult({ kind: 'events', source: file.name.replace(/\.ics$/i, ''), events, skippedRecurring });
    } catch {
      setError({ error: 'Could not read that file.', hint: 'Try exporting it again.' });
    } finally {
      setBusy(false);
    }
  }

  async function fetchFeed(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setImported(null);
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) setError({ error: body.error ?? 'Something went wrong.', hint: body.hint });
      else setResult(body as Result);
    } catch {
      setError({ error: 'Could not reach the server.', hint: 'Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  function keep() {
    if (!result) return;

    if (result.kind === 'assignments') {
      mutate((prev) => ({
        ...prev,
        courses: result.courses,
        assignments: result.assignments,
        lastSyncedAt: new Date().toISOString(),
      }));
      setImported(`${result.courses.length} courses and ${result.assignments.length} assignments`);
      // Counts, never course codes. Whether an import produced anything is the
      // question worth answering, and an empty Canvas feed in week 0 is the
      // single most likely first experience of this product.
      logEvent('feed_synced', {
        courses: result.courses.length,
        assignments: result.assignments.length,
        empty: result.assignments.length === 0,
      });
    } else {
      mutate((prev) => {
        // Re-importing the same calendar shouldn't double everything, so
        // anything previously imported from a feed is replaced rather than
        // added to. Hand-added events are left alone.
        const handAdded = prev.events.filter((e) => !e.id.startsWith('imp-'));
        return { ...prev, events: [...handAdded, ...result.events].sort((a, b) => a.start.localeCompare(b.start)) };
      });
      setImported(`${result.events.length} events from ${result.source}`);
      logEvent('feed_synced', {
        events: result.events.length,
        skippedRecurring: result.skippedRecurring,
        empty: result.events.length === 0,
      });
    }

    replan(new Date());
    setUrl('');
    setResult(null);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold">Import a calendar</h1>
      <p className="mt-1.5 text-[var(--muted)]">
        Canvas, Google, Apple or Outlook. Paste a link, or import a file you exported.
      </p>

      <form onSubmit={fetchFeed} className="mt-6 space-y-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Calendar link"
          placeholder="Paste an iCal or ICS link"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-sm outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--accent-ink)] disabled:bg-transparent disabled:text-[var(--faint)] disabled:ring-1 disabled:ring-[var(--border)] sm:w-auto"
        >
          {busy ? 'Reading…' : 'Import'}
        </button>
      </form>

      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-medium">Using Apple Calendar?</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          A link means publishing your calendar publicly, which is buried in the share settings
          and only works for iCloud calendars. Exporting a file is easier and nothing leaves
          your device: <strong>File, then Export</strong>, then pick the file here.
        </p>
        <label className="mt-3 inline-block cursor-pointer rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm">
          Choose an .ics file
          <input
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              // Cleared so picking the same file twice still fires a change.
              e.target.value = '';
              if (f) void importFile(f);
            }}
          />
        </label>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-[var(--warn)]/40 bg-[var(--accent-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--warn)]">{error.error}</p>
          {error.hint && <p className="mt-1 text-[var(--muted)]">{error.hint}</p>}
        </div>
      )}

      {imported && (
        <div role="status" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-medium">Imported {imported}.</p>
          <Link href="/week" className="mt-2 inline-block text-sm text-[var(--accent)] underline underline-offset-4">
            See your week
          </Link>
        </div>
      )}

      {/* Nothing is saved until it's been looked at. An import that silently
          rewrote a schedule would be the worst kind of surprise. */}
      {result && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-medium">From {result.source}</h2>

          {result.kind === 'assignments' ? (
            <>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {result.courses.length} courses · {result.assignments.length} assignments
              </p>
              {result.courses.length > 0 && (
                <div className="mt-3"><CourseList courses={result.courses} /></div>
              )}
              {result.workload.length > 0 && (
                <div className="mt-4"><WorkloadChart weeks={result.workload.slice(0, 8)} /></div>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {result.events.length} events over the next two months. These become time the
                scheduler plans around.
              </p>
              {result.skippedRecurring > 0 && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {result.skippedRecurring} repeating {result.skippedRecurring === 1 ? 'event repeats' : 'events repeat'}{' '}
                  monthly or yearly, which isn&rsquo;t supported yet — those were left out rather
                  than guessed at.
                </p>
              )}
              <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
                {result.events.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 py-1.5">
                    <span className="w-28 shrink-0 tabular-nums text-[var(--faint)]">
                      {fmtDay(e.start, TZ)} {fmtTime(e.start, TZ)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  </li>
                ))}
              </ul>
              {result.events.length > 6 && (
                <p className="mt-2 text-sm text-[var(--faint)]">…and {result.events.length - 6} more</p>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={keep}
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)]"
            >
              Add to my week
            </button>
            <button onClick={() => setResult(null)} className="px-2 text-sm text-[var(--faint)] underline underline-offset-4">
              discard
            </button>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-medium">Where to find the link</h2>
        <dl className="mt-3 divide-y divide-[var(--border)]">
          {SOURCE_HELP.map((s) => (
            <div key={s.kind} className="py-2.5">
              <dt className="text-sm font-medium">{s.label}</dt>
              <dd className="text-sm text-[var(--muted)]">{s.where}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 rounded-xl border border-[var(--border)] p-4 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]">Treat these links like passwords</p>
        <p className="mt-1">
          Anyone holding one can read that calendar. Quarterly uses it once to fetch, then forgets
          it — nothing is stored, so refreshing later means pasting again.{' '}
          <Link href="/privacy" className="underline underline-offset-4">The privacy page</Link>{' '}
          spells out exactly what that means.
        </p>
      </section>

      {state.courses.length > 0 && (
        <p className="mt-6 text-sm text-[var(--faint)]">
          Currently tracking {state.courses.length} courses and{' '}
          {state.events.filter((e) => e.id.startsWith('imp-')).length} imported events.
        </p>
      )}
    </main>
  );
}
