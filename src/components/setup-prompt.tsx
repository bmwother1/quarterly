'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { isLive, nextPrompt, type StepId } from '@/lib/onboarding';
import type { HeronState } from '@/lib/store';

/**
 * The one setup prompt a student sees, or nothing at all.
 *
 * This replaces a banner that could only ever say one thing ("you have no fixed
 * time") and had no way to be answered. The defect wasn't the copy, it was that
 * the app had no concept of being finished: a student with genuinely nothing
 * fixed got told the same thing every week forever.
 *
 * Three rules hold here:
 *
 * 1. **One prompt, never a stack.** `nextPrompt` picks the single most valuable
 *    unresolved step. Three banners is a to-do list the student didn't write.
 * 2. **Every prompt is answerable in both directions.** The skip is not a
 *    dismiss; it records a real answer and the step stops counting as pending.
 * 3. **Live is permanent.** Once `wentLiveAt` is stamped, nothing in this file
 *    renders again, even if the student later deletes every commitment. Setup
 *    is a phase you leave, not a score you can fall back below.
 */

/** Where each step gets answered, and what the button says. */
const RESOLVE: Record<StepId, { href: string; cta: string }> = {
  work: { href: '/start', cta: 'Add something to plan' },
  fixed: { href: '/setup', cta: 'Add my classes and work' },
  sleep: { href: '/setup', cta: 'Set my sleep hours' },
  calendars: { href: '/import', cta: 'Import a calendar' },
};

export function SetupPrompt({
  state, skipStep, confirmSleep, markLiveIfReady, ackLive,
}: {
  state: HeronState;
  skipStep: (id: StepId) => void;
  confirmSleep: () => void;
  markLiveIfReady: () => void;
  ackLive: () => void;
}) {
  const live = isLive(state);

  // Stamping is a side effect of becoming live, so it belongs in an effect
  // rather than in render. `markLiveIfReady` is a no-op once stamped.
  useEffect(() => {
    if (live) markLiveIfReady();
  }, [live, markLiveIfReady]);

  // The one-time confirmation that setup is over. Worth showing because "you
  // will not be asked again" is only reassuring if somebody says it.
  if (state.wentLiveAt && !state.liveNoticeSeen) {
    return (
      <div className="well enter">
        <h2 className="text-base font-semibold">You&rsquo;re set up.</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          That&rsquo;s the last of the setup questions. Everything from here is your actual
          week. You can change any of it in Settings whenever you like.
        </p>
        <button onClick={ackLive} className="btn-secondary mt-3">
          Got it
        </button>
      </div>
    );
  }

  if (state.wentLiveAt) return null;

  const step = nextPrompt(state);
  if (!step) return null;

  const { href, cta } = RESOLVE[step.id];

  /**
   * "The default is fine" is an answer, not a refusal, so it marks sleep done
   * rather than skipped. The distinction is invisible here and matters later:
   * a skipped step is one we could sensibly revisit, a confirmed one is not.
   */
  const onSkip = step.id === 'sleep' ? confirmSleep : () => skipStep(step.id);

  return (
    <div className="well">
      {/*
        No percentage. A completion meter is a score, and this product refused
        streaks and scores on the grounds that planners punish imperfection.
        A progress bar seconds after a flow whose whole point was avoiding setup
        is the same mistake wearing a different hat.

        Secondary, not filled: this sits under the week, and the week's own
        next block is the one primary action on the screen.
      */}
      <p className="text-sm text-[var(--muted)]">One more thing</p>
      <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{step.blurb}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={href} className="btn-secondary">
          {cta}
        </Link>
        <button onClick={onSkip} className="btn-quiet">
          {step.skipLabel}
        </button>
      </div>
    </div>
  );
}
