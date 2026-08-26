'use client';

import { useEffect, useState } from 'react';
import { sendCode, verifyCode } from '@/supabase/auth';
import {
  CODE_LENGTH, cooldownRemaining, freshVerifyState, isComplete, messageFor,
  normaliseCode, recordFailure, resetAfterResend, RESEND_COOLDOWN_S,
} from '@/lib/verification';

/**
 * Email in, six digits back, signed in. One component, used by onboarding and
 * by Settings.
 *
 * Shared rather than written twice because the awkward half is the same in both
 * places: attempts, expiry, resend cooldown, and the difference between "that
 * code is wrong" and "that code is old". Two copies means one of them ends up
 * with the friendly message and the other with `invalid_token`.
 *
 * Every rule it follows lives in `src/lib/verification.ts`, dependency-free, so
 * the cases that matter can be tested without a network: a third wrong attempt,
 * a code that expired while the student was reading their email, a resend
 * pressed twice.
 */

export function CodeSignIn({
  onSignedIn,
  intro,
}: {
  onSignedIn: () => void;
  intro?: React.ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState(freshVerifyState());
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Ticks only while a cooldown is actually running, so the component is not
  // re-rendering once a second for the rest of the session.
  const waiting = cooldownRemaining(lastSentAt, now);
  useEffect(() => {
    if (waiting <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [waiting]);

  async function requestCode() {
    setBusy(true);
    setError(null);
    const result = await sendCode(email);
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setLastSentAt(Date.now());
    setNow(Date.now());
    setVerify(resetAfterResend());
    setCode('');
    setStage('code');
  }

  async function submitCode() {
    if (verify.exhausted) return;
    setBusy(true);
    setError(null);
    const result = await verifyCode(email, code);
    setBusy(false);

    if (result.ok) { onSignedIn(); return; }

    // State first, then the message, because the message depends on how many
    // tries are left after this one.
    const next = recordFailure(verify);
    setVerify(next);
    setError(messageFor(result.failure, next, result.message));
    setCode('');
  }

  if (stage === 'email') {
    return (
      <div className="space-y-2.5">
        {intro}
        <div className="flex flex-wrap gap-2">
          <input
            type="email" value={email} inputMode="email" autoComplete="email"
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && email.includes('@') && !busy) void requestCode(); }}
            aria-label="Email address" placeholder="you@uw.edu"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2.5 outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
          <button
            onClick={() => { void requestCode(); }}
            disabled={!email.includes('@') || busy}
            className="rounded-lg bg-[var(--accent)] px-3.5 py-2.5 text-sm font-medium text-[var(--accent-ink)] disabled:bg-transparent disabled:text-[var(--faint)] disabled:ring-1 disabled:ring-[var(--border)]"
          >
            {busy ? 'Sending…' : 'Send me a code'}
          </button>
        </div>
        {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
        <p className="text-sm text-[var(--faint)]">
          Six digits, no password. One less thing to invent at 9pm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">Check your email.</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          A {CODE_LENGTH}-digit code is on its way to {email}. Type it here, in this tab.
        </p>
      </div>

      <input
        value={code}
        // Digits only. A code pasted out of an email regularly arrives with a
        // trailing space or a newline attached.
        onChange={(e) => { setCode(normaliseCode(e.target.value)); setError(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && isComplete(code) && !busy) void submitCode(); }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        aria-label={`${CODE_LENGTH}-digit code`}
        placeholder="000000"
        disabled={verify.exhausted}
        className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)] disabled:opacity-50"
      />

      {error && <p className="text-sm text-[var(--warn)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { void submitCode(); }}
          disabled={!isComplete(code) || busy || verify.exhausted}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2.5 text-sm font-medium text-[var(--accent-ink)] disabled:bg-transparent disabled:text-[var(--faint)] disabled:ring-1 disabled:ring-[var(--border)]"
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <button
          onClick={() => { void requestCode(); }}
          disabled={busy || waiting > 0}
          className="text-sm text-[var(--muted)] underline underline-offset-4 disabled:no-underline disabled:text-[var(--faint)]"
        >
          {waiting > 0 ? `Send another in ${waiting}s` : 'Send another code'}
        </button>

        <button
          onClick={() => { setStage('email'); setCode(''); setError(null); }}
          className="text-sm text-[var(--muted)] underline underline-offset-4"
        >
          Wrong address?
        </button>
      </div>

      <p className="text-xs text-[var(--faint)]">
        Codes expire after an hour. A new one replaces the old.
      </p>
    </div>
  );
}

export { RESEND_COOLDOWN_S };
