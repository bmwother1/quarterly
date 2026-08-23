'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { sendMagicLink, signOut } from '@/supabase/auth';
import { fmtDay } from '@/lib/time';

/**
 * Whether an account exists, and whether sync is actually working.
 *
 * The second half is the point. Before this there was no way to tell a working
 * backup from a broken one: both looked like an app that never mentioned
 * accounts. A backup you cannot verify is worse than no backup, because you
 * stop keeping the other kind.
 *
 * So this shows the last successful sync rather than just "signed in". Those are
 * different claims, and only one of them is the one a student cares about after
 * dropping their phone in a lake.
 */
export function AccountPanel({ lastSyncedAt, tz }: { lastSyncedAt: string | null; tz: string }) {
  const { signedIn, email, loading, available } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!available) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Accounts aren&rsquo;t configured in this build. Your week lives on this device only, and the
        backup file below is the way to move it.
      </p>
    );
  }

  if (loading) return <p className="text-sm text-[var(--faint)]">Checking…</p>;

  if (signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          Signed in as <span className="font-medium">{email}</span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          {lastSyncedAt
            ? `Your week was last saved to your account on ${fmtDay(lastSyncedAt, tz)}.`
            : 'Your week has not reached your account yet. It saves a couple of seconds after a change.'}
        </p>
        <button
          onClick={() => { void signOut(); }}
          className="rounded-lg border border-[var(--border-strong)] px-3.5 py-2 text-sm"
        >
          Sign out
        </button>
        <p className="text-xs text-[var(--faint)]">
          Signing out leaves this week on this device. It doesn&rsquo;t delete anything.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Check your email.</p>
        <p className="text-sm text-[var(--muted)]">
          A sign-in link is on its way to {input}.
        </p>
        <p className="text-sm text-[var(--faint)]">
          Open it on this device. The link can only be completed in the browser that asked for it.
        </p>
      </div>
    );
  }

  async function request() {
    setSending(true);
    setError(null);
    const result = await sendMagicLink(input);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  }

  return (
    <div className="space-y-2.5">
      <p className="text-sm text-[var(--muted)]">
        Your week lives only in this browser. An account is what makes it survive a lost phone.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email" value={input}
          onChange={(e) => { setInput(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && input.includes('@') && !sending) void request(); }}
          aria-label="Email address" placeholder="you@uw.edu" autoComplete="email"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
        />
        <button
          onClick={() => { void request(); }}
          disabled={!input.includes('@') || sending}
          className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-[var(--accent-ink)] disabled:bg-transparent disabled:text-[var(--faint)] disabled:ring-1 disabled:ring-[var(--border)]"
        >
          {sending ? 'Sending…' : 'Email me a link'}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--warn)]">{error}</p>}
    </div>
  );
}
