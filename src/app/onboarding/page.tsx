'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { OnboardingShell, Continue } from '@/components/onboarding-shell';
import { CATEGORY_DEMAND } from '@/lib/schedule/score';
import { DEFAULT_TZ } from '@/lib/time';
import type { CommitmentCategory } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { sendMagicLink } from '@/supabase/auth';

const TZ = DEFAULT_TZ;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#e11d48', '#0ea5e9', '#10b981', '#8b5cf6', '#f59e0b'];

/**
 * The guided setup flow, for a student who wants to be walked through it.
 *
 * `/start` stays the default way in: two questions, three seconds, a real week.
 * That decision was made on time-to-value evidence and this does not replace it.
 * This is the other door, for someone who would rather answer everything up
 * front, and it is the flow that ends by making them **live**.
 *
 * The account step is deliberately last. Every measurement of this says the
 * same thing: asking for an identity before the product has done anything for
 * you is where people leave. By the time it's asked here they have a planned
 * week waiting, and the ask has an honest reason ("so it survives your phone
 * dying"), which is a different question from "sign up to continue".
 */

const EXAMPLES: Array<{ title: string; category: CommitmentCategory; per: number; mins: number }> = [
  { title: 'Study for a class', category: 'learning', per: 4, mins: 60 },
  { title: 'Work on my project', category: 'project', per: 3, mins: 90 },
  { title: 'Run', category: 'fitness', per: 4, mins: 40 },
  { title: 'Read', category: 'learning', per: 5, mins: 30 },
];

function toMin(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function Onboarding() {
  const {
    state, hydrated, updateCommitments, updateAvailability,
    confirmSleep, skipStep, markLiveIfReady, replan,
  } = useQuarterly(TZ);
  const router = useRouter();

  const [step, setStep] = useState(1);
  const STEPS = 5;

  // Step 1
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CommitmentCategory>('learning');
  const [perWeek, setPerWeek] = useState(3);
  const [minutes, setMinutes] = useState(60);

  // Step 2
  const [busyLabel, setBusyLabel] = useState('');
  const [busyDays, setBusyDays] = useState<number[]>([]);
  const [busyStart, setBusyStart] = useState('09:00');
  const [busyEnd, setBusyEnd] = useState('10:20');
  const [busyKind, setBusyKind] = useState<'class' | 'work'>('class');

  // Step 3
  const [sleepStart, setSleepStart] = useState('23:00');
  const [sleepEnd, setSleepEnd] = useState('07:00');

  // Step 5
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signedIn, email: signedInAs, available: accountsAvailable } = useAuth();

  async function requestLink() {
    setSending(true);
    setAuthError(null);
    const result = await sendMagicLink(email);
    setSending(false);
    if (result.ok) setSent(true);
    else setAuthError(result.message);
  }

  /**
   * Focus the first field without scrolling to it.
   *
   * `autoFocus` scrolls the field into view, which pushed the heading and the
   * progress bar off the top of the screen: a student on a phone landed in the
   * middle of a form having never seen "Step 1 of 5". `preventScroll` keeps the
   * keyboard convenience without moving the page.
   *
   * `hydrated` is in the deps because the input does not exist on the first
   * render — without it this fires once against nothing and silently does no work.
   */
  const firstField = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (step === 1 && hydrated) firstField.current?.focus({ preventScroll: true });
  }, [step, hydrated]);

  /**
   * Plan the week on arrival at the last step, not on leaving it.
   *
   * The account step is optional and it is the only step that leaves the app,
   * because a magic link lands the student back on `/week` directly. Planning in
   * `finish()` meant anyone who opened the email instead of pressing the button
   * skipped it: they arrived at a calendar built from whatever was there before,
   * or from nothing at all. The first four steps are what earn a plan. Whether
   * they want an account is a separate question and must not gate it.
   */
  useEffect(() => {
    if (step === 5) {
      replan(new Date());
      markLiveIfReady();
    }
  }, [step, replan, markLiveIfReady]);

  if (!hydrated) {
    return <main className="mx-auto max-w-lg px-5 py-16"><p className="text-[var(--muted)]">Loading…</p></main>;
  }

  function addCommitment() {
    const name = title.trim();
    if (!name) return;
    updateCommitments((prev) => [...prev, {
      id: `c-${Date.now()}`, title: name, category,
      sessionsPerWeek: perWeek, minutesPerSession: minutes,
      importance: 0.7, demand: CATEGORY_DEMAND[category],
      lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
      minSessionMinutes: category === 'project' ? 60 : Math.min(30, minutes),
      bufferAfterMinutes: category === 'fitness' ? 10 : 0,
      windowStartMin: category === 'fitness' ? 6 * 60 : null,
      windowEndMin: category === 'fitness' ? 21 * 60 : null,
      active: true, color: COLORS[state.commitments.length % COLORS.length],
    }]);
    setTitle('');
    setStep(2);
  }

  function addBusy() {
    if (!busyDays.length) return;
    const label = busyLabel.trim() || (busyKind === 'class' ? 'Class' : 'Work');
    const stamp = Date.now();
    updateAvailability((prev) => ({
      ...prev,
      busy: [
        ...prev.busy,
        ...busyDays.map((d) => ({
          id: `b-${stamp}-${d}`, day: d,
          startMin: toMin(busyStart), endMin: toMin(busyEnd),
          label, kind: busyKind,
        })),
      ],
    }));
    setBusyLabel('');
    setBusyDays([]);
    setStep(3);
  }

  function saveSleep() {
    const s = toMin(sleepStart);
    const e = toMin(sleepEnd);
    updateAvailability((prev) => ({
      ...prev,
      busy: prev.busy.map((b) => (b.kind === 'sleep' ? { ...b, startMin: s, endMin: e } : b)),
    }));
    confirmSleep();
    setStep(4);
  }

  /** Leaving the flow. The week is already planned by the time this runs. */
  function finish() {
    router.push('/week');
  }

  if (step === 1) {
    return (
      <OnboardingShell
        stepNumber={1} stepCount={STEPS}
        title="What do you want to make time for?"
        blurb="One thing is enough. Quarterly works out when it happens, around everything else in your week."
        onSkip={() => { skipStep('work'); setStep(2); }}
        skipLabel="Skip for now"
        footer={<Continue onClick={addCommitment} disabled={!title.trim()} />}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCommitment(); }}
          aria-label="What you want to make time for"
          placeholder="Studying for CHEM 142"
          ref={firstField}
          className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3.5 text-base outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
        />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e.title}
              onClick={() => { setTitle(e.title); setCategory(e.category); setPerWeek(e.per); setMinutes(e.mins); }}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]"
            >
              {e.title}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-medium">How often?</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n} onClick={() => setPerWeek(n)} aria-pressed={perWeek === n}
                className={`h-10 w-10 rounded-lg text-sm ${perWeek === n ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
              >{n}</button>
            ))}
            <span className="self-center pl-1 text-sm text-[var(--muted)]">× a week</span>
          </div>
          <p className="mt-4 text-sm font-medium">For how long?</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[30, 45, 60, 90, 120].map((m) => (
              <button
                key={m} onClick={() => setMinutes(m)} aria-pressed={minutes === m}
                className={`rounded-lg px-3 py-2 text-sm ${minutes === m ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
              >{m < 60 ? `${m} min` : `${m / 60}h`}</button>
            ))}
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 2) {
    return (
      <OnboardingShell
        stepNumber={2} stepCount={STEPS}
        title="When are you already busy?"
        blurb="Classes, shifts, anything at a fixed time. Nothing gets scheduled over it."
        onSkip={() => { skipStep('fixed'); setStep(3); }}
        skipLabel="I have nothing fixed"
        footer={<Continue onClick={addBusy} disabled={!busyDays.length}>Add it</Continue>}
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['class', 'work'] as const).map((k) => (
              <button
                key={k} onClick={() => setBusyKind(k)} aria-pressed={busyKind === k}
                className={`rounded-lg px-3.5 py-2 text-sm capitalize ${busyKind === k ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
              >{k}</button>
            ))}
          </div>
          <input
            value={busyLabel} onChange={(e) => setBusyLabel(e.target.value)}
            aria-label="Name" placeholder={busyKind === 'class' ? 'CHEM 142 lecture' : 'Pro shop shift'}
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
          <div>
            <p className="mb-2 text-sm font-medium">Which days?</p>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  onClick={() => setBusyDays((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i])}
                  aria-pressed={busyDays.includes(i)}
                  className={`h-11 w-12 rounded-lg text-sm ${busyDays.includes(i) ? 'bg-[var(--accent)] font-medium text-[var(--accent-ink)]' : 'border border-[var(--border)] text-[var(--muted)]'}`}
                >{d}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-[var(--muted)]">From
              <input type="time" value={busyStart} onChange={(e) => setBusyStart(e.target.value)}
                className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]" />
            </label>
            <label className="text-sm text-[var(--muted)]">to
              <input type="time" value={busyEnd} onChange={(e) => setBusyEnd(e.target.value)}
                className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]" />
            </label>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 3) {
    return (
      <OnboardingShell
        stepNumber={3} stepCount={STEPS}
        title="When do you sleep?"
        blurb="So nothing lands at 2am. The default is fine if you'd rather not think about it."
        onSkip={() => { confirmSleep(); setStep(4); }}
        skipLabel="The default is fine"
        footer={<Continue onClick={saveSleep} />}
      >
        <div className="flex items-center gap-3">
          <label className="text-sm text-[var(--muted)]">Asleep by
            <input type="time" value={sleepStart} onChange={(e) => setSleepStart(e.target.value)}
              className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]" />
          </label>
          <label className="text-sm text-[var(--muted)]">Awake at
            <input type="time" value={sleepEnd} onChange={(e) => setSleepEnd(e.target.value)}
              className="ml-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--ink)]" />
          </label>
        </div>
      </OnboardingShell>
    );
  }

  if (step === 4) {
    return (
      <OnboardingShell
        stepNumber={4} stepCount={STEPS}
        title="Import a calendar?"
        blurb="Canvas, Google, Apple or Outlook, so you don't type it all in. Optional, and you can do it later."
        onSkip={() => { skipStep('calendars'); setStep(5); }}
        skipLabel="Not now"
        footer={
          <Link href="/import" className="rounded-xl bg-[var(--accent)] px-6 py-3.5 font-medium text-[var(--accent-ink)] shadow-[var(--shadow-md)]">
            Import a calendar
          </Link>
        }
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          <p>
            If your quarter hasn&rsquo;t been published yet, your Canvas feed will be empty. That&rsquo;s
            normal in the weeks before instruction starts, and it isn&rsquo;t a broken link.
          </p>
        </div>
      </OnboardingShell>
    );
  }

  /**
   * Step 5. The account ask, and the only step that talks to a server.
   *
   * Three states, and the middle one is the one that matters: a student who
   * followed a magic link from a previous attempt arrives here already signed
   * in, and being asked to sign in again would read as the app having lost
   * them. Checked before the form is offered at all.
   */
  if (signedIn) {
    return (
      <OnboardingShell
        stepNumber={5} stepCount={STEPS}
        title="You're signed in."
        blurb={`Your week will sync to ${signedInAs}, so it survives a lost phone or a second browser.`}
        footer={<Continue onClick={finish}>Take me to my week</Continue>}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
          <p>Nothing else to set up. You can sign out any time in Settings.</p>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepNumber={5} stepCount={STEPS}
      title="Keep this if you lose your phone?"
      blurb="Your week lives on this device. An account is the only way it survives a lost phone or a second browser."
      onSkip={finish}
      skipLabel="No thanks, keep it on this device"
      footer={
        sent
          ? <Continue onClick={finish}>Take me to my week</Continue>
          : (
            <Continue
              onClick={requestLink}
              disabled={!email.includes('@') || sending || !accountsAvailable}
            >
              {sending ? 'Sending…' : 'Email me a link'}
            </Continue>
          )
      }
    >
      {!accountsAvailable && (
        <div className="mb-4 rounded-lg border border-[var(--warn)]/40 bg-[var(--accent-soft)] px-3.5 py-2.5 text-xs text-[var(--warn)]">
          Accounts aren&rsquo;t configured in this build. Skip for now and your week stays on this device.
        </div>
      )}

      {sent ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="font-medium">Check your email.</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            A sign-in link is on its way to {email}. Opening it brings you straight back here,
            already signed in. No password to invent and none to forget.
          </p>
          <p className="mt-2 text-sm text-[var(--faint)]">
            You don&rsquo;t have to wait for it. Carry on and open the link whenever.
          </p>
        </div>
      ) : (
        <>
          <input
            type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@') && !sending) requestLink(); }}
            aria-label="Email address" placeholder="you@uw.edu" autoComplete="email"
            className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3.5 outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
          {authError ? (
            <p className="mt-2.5 text-sm text-[var(--warn)]">{authError}</p>
          ) : (
            <p className="mt-2.5 text-sm text-[var(--faint)]">
              A link, not a password. One less thing to invent at 9pm.
            </p>
          )}
        </>
      )}
    </OnboardingShell>
  );
}
