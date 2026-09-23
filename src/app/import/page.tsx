'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
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
  const { state, mutate, replan } = useHeron(TZ);
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

  const link = 'text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]';

  return (
    <main className="rise mx-auto max-w-2xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-heading font-semibold">Import a calendar</h1>
      <p className="mt-2 text-base text-[var(--muted)]">
        Canvas, Google, Apple or Outlook. Paste a link, or import a file you exported.
      </p>

      <form onSubmit={fetchFeed} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Calendar link"
          aria-describedby={error ? 'import-error' : undefined}
          aria-invalid={error ? true : undefined}
          placeholder="Paste an iCal or ICS link"
          autoComplete="off"
          spellCheck={false}
          className="field min-w-0 flex-1"
        />
        {/* While an import waits to be confirmed below, that is the step that
            matters, so this one steps back to secondary. */}
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className={result ? 'btn-secondary' : 'btn-primary'}
        >
          {busy ? 'Reading…' : 'Import'}
        </button>
      </form>

      {/* Straight under the field that caused it, not below the next section. */}
      {error && (
        <div id="import-error" role="alert" className="enter mt-3 border-l-3 border-[var(--warn)] pl-3 text-sm">
          <p className="font-medium text-[var(--warn)]">{error.error}</p>
          {error.hint && <p className="mt-1 text-[var(--muted)]">{error.hint}</p>}
        </div>
      )}

      {imported && (
        <div role="status" className="well enter mt-4">
          <p className="text-base font-semibold">Imported {imported}.</p>
          <Link href="/week" className="btn-secondary mt-3">
            See your week
          </Link>
        </div>
      )}

      {/* Nothing is saved until it's been looked at. An import that silently
          rewrote a schedule would be the worst kind of surprise. The one box
          on this page, because it is a decision waiting to be made. */}
      {result && (
        <section className="enter mt-6 rounded-md border border-[var(--border)] p-4">
          <h2 className="text-base font-semibold">From {result.source}</h2>

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
                  monthly or yearly, which isn&rsquo;t supported yet, so those were left out rather
                  than guessed at.
                </p>
              )}
              <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
                {result.events.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3 py-2">
                    <span className="w-28 shrink-0 text-[var(--muted)]">
                      {fmtDay(e.start, TZ)} {fmtTime(e.start, TZ)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                  </li>
                ))}
              </ul>
              {result.events.length > 6 && (
                <p className="mt-2 text-sm text-[var(--muted)]">and {result.events.length - 6} more</p>
              )}
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={keep} className="btn-primary">
              Add to my week
            </button>
            <button onClick={() => setResult(null)} className="btn-quiet">
              Discard
            </button>
          </div>
        </section>
      )}

      <section className="mt-10 border-t border-[var(--border)] pt-6">
        <h2 className="text-base font-semibold">Using Apple Calendar?</h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          A link means publishing your calendar publicly, which is buried in the share settings
          and only works for iCloud calendars. Exporting a file is easier and nothing leaves
          your device: <span className="text-[var(--ink)]">File, then Export</span>, then pick the file here.
        </p>
        <label className="btn-secondary mt-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--accent)]">
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
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-6">
        <h2 className="text-base font-semibold">Where to find the link</h2>
        <dl className="mt-2 divide-y divide-[var(--border)]">
          {SOURCE_HELP.map((s) => (
            <div key={s.kind} className="py-3">
              <dt className="text-sm font-semibold">{s.label}</dt>
              <dd className="mt-1 text-sm text-[var(--muted)]">{s.where}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-6">
        <h2 className="text-base font-semibold">Treat these links like passwords</h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          Anyone holding one can read that calendar. Heron uses it once to fetch, then forgets
          it. Nothing is stored, so refreshing later means pasting again.{' '}
          <Link href="/privacy" className={link}>The privacy page</Link>{' '}
          spells out exactly what that means.
        </p>
      </section>

      {state.courses.length > 0 && (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Currently tracking {state.courses.length} courses and{' '}
          {state.events.filter((e) => e.id.startsWith('imp-')).length} imported events.
        </p>
      )}
    </main>
  );
}
