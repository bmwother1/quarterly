'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
import { useNarrow } from '@/hooks/use-narrow';
import { categoryForCommitment, nextShade, takenShades } from '@/lib/categories';
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


export default function Start() {
  const { state, hydrated, updateCommitments, replan } = useHeron(TZ);
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('learning');
  const [perWeek, setPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(60);

  /**
   * Focus the field on a laptop and never on a phone.
   *
   * `autoFocus` was doing more harm than good here. On iOS it does not open the
   * keyboard at all, because Safari only does that for a real gesture, so it
   * buys nothing. On Android it does open it, and the keyboard then covers the
   * bottom half of the screen, which on this page is where "How often?" and the
   * button both live. Either way it scrolls the field into view and pushes the
   * question off the top.
   *
   * `preventScroll` for the same reason `/onboarding` uses it: the convenience
   * of a ready cursor is not worth moving the page out from under someone.
   */
  const narrow = useNarrow();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!narrow && hydrated) field.current?.focus({ preventScroll: true });
  }, [narrow, hydrated]);

  // Nothing here depends on stored state until the button is pressed, but the
  // examples do read it, so the page waits the one frame hydration takes
  // rather than rendering twice. An empty main of the same size, not a word.
  if (!hydrated) {
    return <main className="mx-auto min-h-[60vh] max-w-lg px-5 pt-12 sm:pt-20" aria-busy="true" />;
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
      // Assigned once from what is already taken in this category, so removing
      // a commitment frees its shade instead of recolouring the others.
      shade: nextShade(
        categoryForCommitment(category),
        takenShades(
          state.commitments.map((c) => ({ category: categoryForCommitment(c.category), shade: c.shade })),
          categoryForCommitment(category),
        ),
      ),
    }]);

    replan(new Date());
    router.push('/week');
  }

  return (
    <main className="rise mx-auto max-w-lg px-5 pb-12 pt-12 sm:pt-20">
      <h1 className="text-heading font-semibold">
        What do you want to make time for?
      </h1>
      <p className="mt-2 text-base text-[var(--muted)]">
        One thing is enough to start. Heron works out when it happens, around everything else
        in your week.
      </p>

      <div className="mt-8 space-y-8">
        <div>
          <input
            ref={field}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') begin(); }}
            aria-label="What you want to make time for"
            placeholder="Studying for CHEM 142"
            className="field min-h-12 w-full px-4"
          />
          {/* An empty box is a harder question than a list of answers. */}
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => {
              // Tapping an example fills four fields at once, so it has to look
              // chosen afterwards. Without this the page silently changed three
              // answers below the fold and nothing on screen said which example
              // did it. The chip carries the state in its text and border as
              // well as its fill, because --accent-soft is close to invisible
              // against the page in dark mode.
              const picked = title === e.title;
              return (
                <button
                  key={e.title}
                  onClick={() => {
                    setTitle(e.title);
                    setCategory(e.category);
                    setPerWeek(e.per);
                    setMinutes(e.mins);
                  }}
                  aria-pressed={picked}
                  className="chip"
                >
                  {e.title}
                </button>
              );
            })}
          </div>
        </div>

        <div role="group" aria-labelledby="how-often">
          {/* "a week" lives in the question, so all seven fit on one row at 375px. */}
          <p id="how-often" className="text-sm font-semibold">How many times a week?</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                onClick={() => setPerWeek(n)}
                aria-pressed={perWeek === n}
                aria-label={`${n} a week`}
                className="chip w-10 justify-center px-0"
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-labelledby="how-long">
          <p id="how-long" className="text-sm font-semibold">For how long?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[30, 45, 60, 90, 120].map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className="chip"
              >
                {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}` : `${m / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {/*
          Pinned to the bottom of a phone screen.
          Measured at 375x812: this page is 1154px tall and the button sat at
          795px, so the action that completes the most-defended screen in the
          product was below the fold on every phone, before Safari's own chrome
          takes another hundred pixels. Sticky rather than fixed so it sits in
          normal flow on a laptop and needs no spacer.
        */}
        <div className="sticky bottom-0 -mx-5 border-t border-[var(--border)] bg-[var(--bg)] px-5 pt-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0"
             style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={begin} disabled={!title.trim()} className="btn-primary btn-lg w-full">
            Plan my week
          </button>
        </div>

        <p className="text-center text-sm text-[var(--muted)]">
          No account. Nothing to install.{' '}
          <Link href="/onboarding" className="text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]">
            Or set everything up properly
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
