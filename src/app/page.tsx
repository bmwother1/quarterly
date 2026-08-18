'use client';

import { useState } from 'react';
import type { Assignment, Course } from '@/lib/types';
import { WorkloadChart, CourseList, UpcomingList, type WorkloadWeek } from '@/components/workload-chart';

interface FeedResult {
  assignments: Assignment[];
  courses: Course[];
  workload: WorkloadWeek[];
  fetchedAt: string;
  demo?: boolean;
}

type State =
  | { step: 'intake' }
  | { step: 'loading' }
  | { step: 'error'; error: string; hint?: string }
  | { step: 'ready'; data: FeedResult };

export default function Home() {
  const [state, setState] = useState<State>({ step: 'intake' });
  const [url, setUrl] = useState('');

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setState({ step: 'loading' });
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ step: 'error', error: body.error ?? 'Something went wrong.', hint: body.hint });
        return;
      }
      setState({ step: 'ready', data: body as FeedResult });
    } catch {
      setState({ step: 'error', error: 'Could not reach the server.', hint: 'Check your connection and try again.' });
    }
  }

  async function showDemo() {
    setState({ step: 'loading' });
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error();
      setState({ step: 'ready', data: (await res.json()) as FeedResult });
    } catch {
      setState({ step: 'error', error: 'Could not load the sample quarter.' });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:py-20">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">Quarterly</h1>
        <p className="mt-1 text-[var(--muted)]">
          Your quarter, planned. Free for students.
        </p>
      </header>

      {state.step === 'ready' ? (
        <Results data={state.data} onReset={() => { setUrl(''); setState({ step: 'intake' }); }} />
      ) : (
        <Intake
          url={url}
          setUrl={setUrl}
          onSubmit={connect}
          loading={state.step === 'loading'}
          error={state.step === 'error' ? state : undefined}
          onDemo={showDemo}
        />
      )}
    </main>
  );
}

function Intake({
  url, setUrl, onSubmit, loading, error, onDemo,
}: {
  url: string;
  setUrl: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error?: { error: string; hint?: string };
  onDemo: () => void;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="feed" className="block text-sm font-medium">
          Paste your Canvas calendar feed
        </label>
        <input
          id="feed"
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://canvas.uw.edu/feeds/calendars/user_….ics"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40 sm:w-auto"
        >
          {loading ? 'Reading your quarter…' : 'Show me my quarter'}
        </button>
      </form>

      <p className="mt-3 text-sm text-[var(--muted)]">
        Not ready to hand over a link?{' '}
        <button onClick={onDemo} disabled={loading} className="underline underline-offset-4 disabled:opacity-40">
          See it with a sample quarter
        </button>
        .
      </p>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-[var(--warn)]/40 bg-[var(--accent-soft)] p-3 text-sm">
          <p className="font-medium text-[var(--warn)]">{error.error}</p>
          {error.hint && <p className="mt-1 text-[var(--muted)]">{error.hint}</p>}
        </div>
      )}

      <section className="mt-10 space-y-4 text-sm text-[var(--muted)]">
        <div>
          <h2 className="font-medium text-[var(--ink)]">Where to find it</h2>
          <p className="mt-1">
            In Canvas, open <strong className="font-medium text-[var(--ink)]">Calendar</strong>, then click{' '}
            <strong className="font-medium text-[var(--ink)]">Calendar Feed</strong> in the right-hand sidebar.
          </p>
        </div>
        <div>
          <h2 className="font-medium text-[var(--ink)]">Treat that link like a password</h2>
          <p className="mt-1">
            Anyone holding it can see your whole schedule. We read it, show you your quarter, and
            don&rsquo;t store it. Don&rsquo;t post it anywhere.
          </p>
        </div>
        <div>
          <h2 className="font-medium text-[var(--ink)]">Between quarters?</h2>
          <p className="mt-1">
            Canvas feeds only carry 30 days back and a year forward, so they&rsquo;re often empty over
            a break. That&rsquo;s expected, not a failure.
          </p>
        </div>
      </section>
    </>
  );
}

function Results({ data, onReset }: { data: FeedResult; onReset: () => void }) {
  // The server's fetch time is the clock. Reading Date.now() here would be
  // impure during render and could differ between server and client passes.
  const now = new Date(data.fetchedAt).getTime();
  const upcoming = data.assignments.filter((a) => new Date(a.due).getTime() >= now);
  const hours = Math.round(upcoming.reduce((s, a) => s + a.estimatedMinutes, 0) / 60);

  // Weeks that already finished are noise; start from the one we're in.
  const currentWeek = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
  const weeks = data.workload.filter((w) => w.weekStart >= currentWeek);

  // The launch-window case. UW autumn quarter starts September 30, students
  // will onboard in the days before it, and Canvas often has nothing published
  // yet. "0 courses · 0 assignments" reads as a broken app; it isn't.
  if (data.assignments.length === 0) {
    return <EmptyQuarter demo={data.demo} onReset={onReset} />;
  }

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium">Your quarter</h2>
          <button onClick={onReset} className="text-sm text-[var(--muted)] underline underline-offset-4">
            use a different feed
          </button>
        </div>
        {data.demo && (
          <p className="mt-2 inline-block rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
            sample data
          </p>
        )}
        <p className="mt-1 text-sm text-[var(--muted)]">
          {data.courses.length} courses · {data.assignments.length} assignments ·{' '}
          {upcoming.length} still ahead of you · roughly {hours} hours of work
        </p>
        <div className="mt-4">
          <CourseList courses={data.courses} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Workload by week</h2>
        <p className="mb-4 mt-1 text-sm text-[var(--muted)]">
          Every deadline in your feed, bucketed by the week it lands in.
        </p>
        <WorkloadChart weeks={weeks} />
      </section>

      <section>
        <h2 className="text-lg font-medium">Next up</h2>
        <div className="mt-2">
          <UpcomingList assignments={data.assignments} now={now} />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="font-medium">Next: tell it when you&rsquo;re free</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Knowing the deadlines is the easy half. The scheduler needs your classes, sleep, and
          work shifts before it can lay out a week worth following.
        </p>
      </section>
    </div>
  );
}

function EmptyQuarter({ demo, onReset }: { demo?: boolean; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">Your feed works. It&rsquo;s just empty.</h2>
        <button onClick={onReset} className="text-sm text-[var(--muted)] underline underline-offset-4">
          use a different feed
        </button>
      </div>

      <p className="text-sm text-[var(--muted)]">
        We reached Canvas and read your calendar. There are no assignments in it yet.
        {demo ? ' (This was sample data.)' : ''}
      </p>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
        <h3 className="font-medium">This is almost always timing, not a mistake</h3>
        <ul className="mt-2 space-y-2 text-[var(--muted)]">
          <li>
            Canvas feeds carry 30 days back and a year forward, so between quarters
            there&rsquo;s genuinely nothing there.
          </li>
          <li>
            Instructors publish assignments when they publish the course, often in the
            last week before instruction begins. Before that the calendar is bare even
            though you&rsquo;re enrolled.
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
        <h3 className="font-medium">What you can do now</h3>
        <p className="mt-2 text-[var(--muted)]">
          Set up your week anyway. Your classes, sleep and work shifts don&rsquo;t depend on
          Canvas, and they&rsquo;re half of what the scheduler needs. When your courses go
          live, the deadlines drop straight into a week that&rsquo;s already shaped
          around you.
        </p>
      </div>
    </div>
  );
}
