'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WeekSketch, PLANNED, MISSED, REBUILT } from '@/components/week-sketch';

/**
 * Three screens, before anything is asked for.
 *
 * **Why this exists at all.** Told about Heron, people say "doesn't Outlook
 * do this?" and "isn't that what Monday does?". That is not a copywriting
 * failure; the landing page already leads with the right sentence. It is that a
 * description of a scheduler and a description of a calendar use the same words,
 * so a listener maps it onto whatever tool they already own. The only thing that
 * breaks the mapping is watching a week repair itself, because no calendar app
 * has ever done that.
 *
 * **Why it does not contradict the two-question first run.** The evidence behind
 * that decision is about *setup* burden: abandonment climbs past ten minutes of
 * configuration, and Motion's two-to-four week setup is its most-cited
 * complaint. None of that is about a ten-second explanation with nothing to fill
 * in. This asks for no input, it is skippable from the first frame, and the fast
 * path into `/start` is still one tap away.
 *
 * **Why the middle slide is the one that matters.** Slides one and three
 * describe things a determined competitor could copy. The rebuild is the only
 * one that is structurally out of reach for a calendar, because a calendar has
 * no idea what should have happened.
 */

interface Slide {
  title: string;
  body: string;
  render: () => React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'Your week, already decided',
    body: 'Not a list of what is due. Actual hours, in sessions long enough to be worth sitting down for, fitted around class, work and sleep.',
    render: () => <WeekSketch blocks={PLANNED} />,
  },
  {
    title: 'Fall behind and it rebuilds',
    body: 'Miss two days and nothing is lost and nothing is pretended. Say what actually happened and the rest of the week reforms around what is left.',
    // The whole reason for the carousel. Held on the missed state long enough to
    // register as a problem, then resolved, because the repair is the product.
    render: () => <RebuildDemo />,
  },
  {
    title: 'It will not lie about your time',
    body: 'Every other planner quietly overbooks you and lets Thursday deliver the news. This one tells you what did not fit while you can still do something about it.',
    render: () => <DidntFit />,
  },
];

/**
 * The three-beat loop: here is your week, two days went by, here it is repaired.
 *
 * It starts from the intact week rather than the broken one because the repair
 * only means something if you saw what it was repairing. Starting at "missed"
 * showed the punchline with no setup.
 *
 * It loops because this is the one slide people will sit on, and a viewer who
 * looked away for two seconds should not have to work out how to replay it.
 * Timings are uneven on purpose: long enough on the broken state to feel like a
 * problem, longest on the result.
 *
 * Mounted fresh when the slide is shown, so leaving and returning restarts it.
 */
const BEATS = [
  { blocks: PLANNED, caption: 'Your week, as planned', hold: 1900 },
  { blocks: MISSED, caption: 'Tuesday and Wednesday went by', hold: 2100 },
  { blocks: REBUILT, caption: 'Rebuilt around what is left', hold: 3400 },
] as const;

function RebuildDemo() {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), BEATS[beat].hold);
    return () => clearTimeout(t);
  }, [beat]);

  return (
    <div>
      <WeekSketch blocks={BEATS[beat].blocks} />
      <p className="mt-2 text-center text-xs text-[var(--faint)] transition-opacity duration-300">
        {BEATS[beat].caption}
      </p>
    </div>
  );
}

function DidntFit() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--faint)]">Didn&rsquo;t fit</p>
      <p className="mt-2 text-sm font-medium">CHEM 142 problem set</p>
      <p className="text-xs text-[var(--muted)]">
        1 session short. The week ran out before you hit the target.
      </p>
      <p className="mt-3 text-sm font-medium">Run</p>
      <p className="text-xs text-[var(--muted)]">
        4 of 5. Two shifts and an exam left one evening too short.
      </p>
    </div>
  );
}

export default function Welcome() {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col px-5 pb-10 pt-8">
      <div className="mb-6 flex justify-end">
        {/* Reachable from the first frame. A walkthrough you cannot leave is one
            people back out of entirely. */}
        <Link href="/start" className="text-sm text-[var(--muted)] underline underline-offset-4">
          Skip
        </Link>
      </div>

      <div className="flex-1">
        {SLIDES[i].render()}

        <h1 className="rise mt-7 text-[1.6rem] font-semibold leading-tight">{SLIDES[i].title}</h1>
        <p className="rise mt-2.5 leading-relaxed text-[var(--muted)]">{SLIDES[i].body}</p>
      </div>

      <div className="mt-8">
        <div className="mb-5 flex justify-center gap-1.5" role="tablist" aria-label="Slides">
          {SLIDES.map((s, n) => (
            <button
              key={s.title}
              onClick={() => setI(n)}
              role="tab"
              aria-selected={n === i}
              aria-label={s.title}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border-strong)]'
              }`}
            />
          ))}
        </div>

        {last ? (
          <Link
            href="/onboarding"
            className="block w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 text-center font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)]"
          >
            Get started
          </Link>
        ) : (
          <button
            onClick={() => setI((n) => n + 1)}
            className="w-full rounded-xl bg-[var(--accent)] px-5 py-3.5 font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)]"
          >
            Next
          </button>
        )}

        <p className="mt-3 text-center text-sm text-[var(--faint)]">
          No account needed. Nothing to install.
        </p>
      </div>
    </main>
  );
}
