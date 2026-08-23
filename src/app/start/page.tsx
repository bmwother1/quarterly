'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { CATEGORY_DEMAND } from '@/lib/schedule/score';
import { DEFAULT_TZ } from '@/lib/time';
import type { CommitmentCategory } from '@/lib/types';

const TZ = DEFAULT_TZ;

/**
 * First run: two questions, then a planned week.
 *
 * The benchmark for time-to-first-value is 60–90 seconds, and abandonment
 * roughly triples once setup passes thirty minutes. Motion's 2–4 week setup is
 * its single most-cited complaint. The previous route into this product was a
 * five-section form, which is the same mistake in miniature.
 *
 * Everything except one thing already has a working default — sleep, energy,
 * daily hours. The only input the scheduler genuinely cannot invent is
 * something to schedule, so that's the only thing asked for up front.
 */

const EXAMPLES: Array<{ title: string; category: CommitmentCategory; per: number; mins: number }> = [
  { title: 'Run', category: 'fitness', per: 4, mins: 40 },
  { title: 'Study for a class', category: 'learning', per: 4, mins: 60 },
  { title: 'Work on my project', category: 'project', per: 3, mins: 90 },
  { title: 'Read', category: 'learning', per: 5, mins: 30 },
  { title: 'Gym', category: 'fitness', per: 3, mins: 60 },
  { title: 'Practice', category: 'personal', per: 3, mins: 45 },
];

const COLORS = ['#e11d48', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b'];

export default function Start() {
  const { state, hydrated, updateCommitments, replan } = useQuarterly(TZ);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('learning');
  const [perWeek, setPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(60);

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-lg px-5 py-16">
        <p className="text-[var(--muted)]">Loading…</p>
      </main>
    );
  }

  function begin() {
    const name = title.trim();
    if (!name) return;

    updateCommitments((prev) => [...prev, {
      id: `c-${Date.now()}`,
      title: name,
      category,
      sessionsPerWeek: perWeek,
      minutesPerSession: minutes,
      importance: 0.7,
      demand: CATEGORY_DEMAND[category],
      lastDoneAt: null,
      doneThisWeek: 0,
      maxPerDay: 1,
      minSessionMinutes: category === 'project' ? 60 : Math.min(30, minutes),
      bufferAfterMinutes: category === 'fitness' ? 10 : 0,
      windowStartMin: category === 'fitness' ? 6 * 60 : null,
      windowEndMin: category === 'fitness' ? 21 * 60 : null,
      active: true,
      color: COLORS[state.commitments.length % COLORS.length],
    }]);

    replan(new Date());
    router.push('/week');
  }

  return (
    <main className="rise mx-auto max-w-lg px-5 py-14 sm:py-20">
      <h1 className="text-[1.9rem] font-semibold leading-tight sm:text-[2.3rem]">
        What do you want to make time for?
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        One thing is enough to start. Quarterly works out when it happens, around everything else
        in your week.
      </p>

      <div className="mt-7 space-y-5">
        <div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') begin(); }}
            aria-label="What you want to make time for"
            placeholder="Studying for CHEM 142"
            autoFocus
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3.5 text-base outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
          {/* An empty box is a harder question than a list of answers. */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e.title}
                onClick={() => {
                  setTitle(e.title);
                  setCategory(e.category);
                  setPerWeek(e.per);
                  setMinutes(e.mins);
                }}
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--ink)]"
              >
                {e.title}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium">How often?</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setPerWeek(n)}
                aria-pressed={perWeek === n}
                className={`h-10 w-10 rounded-lg text-sm transition-colors ${
                  perWeek === n
                    ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]'
                    : 'border border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {n}
              </button>
            ))}
            <span className="self-center pl-1 text-sm text-[var(--muted)]">× a week</span>
          </div>

          <p className="mt-4 text-sm font-medium">For how long?</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[30, 45, 60, 90, 120].map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  minutes === m
                    ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]'
                    : 'border border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {m < 60 ? `${m} min` : `${m / 60}h${m % 60 ? ' 30' : ''}`}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={begin}
          disabled={!title.trim()}
          className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)] transition-transform active:scale-[0.98] disabled:bg-transparent disabled:text-[var(--faint)] disabled:shadow-none disabled:ring-1 disabled:ring-[var(--border)]"
        >
          Plan my week
        </button>

        <p className="text-center text-sm text-[var(--faint)]">
          No account. Nothing to install.{' '}
          <Link href="/onboarding" className="underline underline-offset-4">
            Or set everything up properly
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
