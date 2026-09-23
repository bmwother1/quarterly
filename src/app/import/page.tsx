'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
import { useFeed, describeRefresh } from '@/hooks/use-feed';
import { applyCanvas, describeMerge } from '@/lib/canvas/merge';
import { logEvent } from '@/supabase/events';
import { eventsFromICS, replaceSourceEvents } from '@/lib/calendar/import';
import { looksLikeCalendar } from '@/lib/canvas/ics';
import { WorkloadChart, CourseList } from '@/components/workload-chart';
import { SOURCE_HELP } from '@/lib/calendar/sources';
import { DEFAULT_TZ, fmtDay, fmtTime } from '@/lib/time';
import type { Assignment, Course, FixedEvent } from '@/lib/types';

const TZ = DEFAULT_TZ;

type Result =
  | { kind: 'assignments'; source: string; assignments: Assignment[]; courses: Course[]; workload: Array<{ weekStart: string; count: number; minutes: number; hasExam: boolean }>; demo?: boolean }
  | {
      kind: 'events';
      source: string;
      /** Host and calendar name, or `file:<name>`. Which events a re-import replaces. */
      sourceKey: string;
      sourceKind?: string;
      events: FixedEvent[];
      skippedRecurring: number;
      /** A file was chosen rather than a link pasted, so there is nothing to remember. */
      fromFile?: boolean;
    };

/**
 * One box for every calendar a student has.
 *
 * The same paste works for Canvas, a work schedule, Google, Apple, Outlook or
 * any other calendar link: the server decides what the contents mean from
 * where they came from, so there's nothing to choose here. Fewer decisions is
 * the entire point of a one-stop import.
 */
export default function ImportPage() {
  const { state, mutate, replan } = useHeron(TZ);
  const { remembered, busy: refreshing, refresh, remember, forget } = useFeed(TZ);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ error: string; hint?: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [imported, setImported] = useState<string | null>(null);
  /**
   * Ticked by default, and only ever shown once a fetch has worked.
   *
   * Offering it before anything has happened asks a student to make a privacy
   * decision about a link that might not even be valid. Offering it on the
   * result, next to their own courses, is the moment they can see what it is
   * for. Default-on because the cost of forgetting is one tap in two places and
   * the cost of *not* remembering is a desktop browser in week four.
   */
  const [rememberIt, setRememberIt] = useState(true);
  const [refreshed, setRefreshed] = useState<string | null>(null);

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

      const name = file.name.replace(/\.ics$/i, '');
      setResult({ kind: 'events', source: name, sourceKey: `file:${name}`, events, skippedRecurring, fromFile: true });
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
      /**
       * Merged, never replaced.
       *
       * The straight replace this used to do was invisible when importing was a
       * once-a-quarter event and is destructive now that it is weekly: it threw
       * away every completed assignment, every minute recorded against one, and
       * every task the student had typed by hand at /start. It also repainted
       * the course colours, because the server builds its `courses` without
       * knowing which shades were already spoken for.
       */
      let said: string | null = null;
      mutate((prev) => {
        const { next, merge } = applyCanvas(prev, result.assignments, new Date().toISOString());
        said = describeMerge(merge);
        return next;
      });
      setImported(
        said
          ? `${result.courses.length} courses · ${said}`
          : `${result.courses.length} courses and ${result.assignments.length} assignments`,
      );

      // Remembering happens here rather than at fetch time, so a link is only
      // kept once the student has seen what it produced and said keep it.
      if (rememberIt && !result.demo) remember({ url, label: 'Canvas', kind: 'assignments', sourceKey: null });

      // Counts, never course codes. Whether an import produced anything is the
      // question worth answering, and an empty Canvas feed in week 0 is the
      // single most likely first experience of this product.
      logEvent('feed_synced', {
        courses: result.courses.length,
        assignments: result.assignments.length,
        empty: result.assignments.length === 0,
        remembered: rememberIt,
      });
    } else {
      // Re-importing a calendar replaces that calendar and nothing else. It used
      // to replace every imported event, so a work schedule wiped the timetable.
      mutate((prev) => ({ ...prev, events: replaceSourceEvents(prev.events, result.sourceKey, result.events) }));
      setImported(`${result.events.length} events from ${result.source}`);
      if (rememberIt && !result.fromFile) {
        remember({ url, label: result.source, kind: 'events', sourceKey: result.sourceKey });
      }
      logEvent('feed_synced', {
        events: result.events.length,
        skippedRecurring: result.skippedRecurring,
        empty: result.events.length === 0,
        remembered: rememberIt && !result.fromFile,
        work: result.sourceKind === 'work',
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
        Canvas, your work schedule, Google, Apple, Outlook, or any other calendar link. Paste
        it here, or import a file you exported.
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

          {/* Only once a fetch has worked, next to what it found, which is the
              moment a student can see what remembering it is for. */}
          {((result.kind === 'assignments' && !result.demo) || (result.kind === 'events' && !result.fromFile)) && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-[var(--border)] pt-4 text-sm">
              <input
                type="checkbox"
                checked={rememberIt}
                onChange={(e) => setRememberIt(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="font-medium">Remember this link</span>
                <span className="mt-1 block text-[var(--muted)]">
                  {result.kind === 'assignments'
                    ? 'Heron then checks Canvas once a day and fits new assignments into your week, so work posted the week it is due still shows up.'
                    : `Heron then checks ${result.source} once a day, so a changed ${result.sourceKind === 'work' ? 'shift' : 'event'} shows up without you pasting again.`}{' '}
                  It stays in this browser: never on our server, never in your account, never
                  in a backup. Forget it any time, here or in Settings.
                </span>
              </span>
            </label>
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

      {/* The whole point: updating a calendar is a button on a phone, not a trip
          to a laptop to find a feed URL again. Heron also does it daily on its own. */}
      {remembered.length > 0 && (
        <section className="mt-10 border-t border-[var(--border)] pt-6">
          <h2 className="text-base font-semibold">Saved links, checked daily</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Signed in, they are on every device you use, encrypted. Never in your backups.
          </p>
          <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {remembered.map((f) => (
              <li key={f.url} className="flex items-center gap-3 py-1 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-[var(--muted)]"> · {f.host}</span>
                </span>
                <button
                  onClick={() => { forget(f.url); setRefreshed(`Forgot ${f.label}. It is gone from this browser.`); }}
                  className="btn-quiet shrink-0 px-2"
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
          <button
            disabled={refreshing}
            onClick={() => {
              setRefreshed(null);
              void refresh('tap').then((r) => setRefreshed(describeRefresh(r)));
            }}
            className="btn-secondary mt-3"
          >
            {refreshing ? 'Checking…' : 'Check them all now'}
          </button>
        </section>
      )}
      {/* Outside the section, because forgetting the last link removes it. A
          revocation with no confirmation reads as a button that did nothing. */}
      {refreshed && <p role="status" className="enter mt-3 text-sm">{refreshed}</p>}

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
              {s.note && <dd className="mt-1 text-sm text-[var(--muted)]">{s.note}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-6">
        <h2 className="text-base font-semibold">Treat these links like passwords</h2>
        <p className="mt-1 text-base text-[var(--muted)]">
          Anyone holding one can read that calendar, indefinitely, without logging in. So
          Heron only keeps yours if you ask it to, and never writes it to a log.
        </p>
        <p className="mt-2 text-base text-[var(--muted)]">
          If you tick <span className="text-[var(--ink)]">Remember this link</span>, Heron uses it
          to check that calendar once a day. Signed out, it is kept in this browser and nowhere
          else. Signed in, it is also saved to your account, encrypted, so your phone and laptop
          both have it; the key that opens it is not stored in the database. It is never in the
          backup file you can download. Forgetting it here or in Settings removes it from every
          device, and so does deleting your data.{' '}
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
