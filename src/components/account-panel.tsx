'use client';

import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/supabase/auth';
import { CodeSignIn } from './code-sign-in';
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

  return (
    <CodeSignIn
      onSignedIn={() => { /* useAuth re-renders this panel into the signed-in branch. */ }}
      intro={
        <p className="text-sm text-[var(--muted)]">
          Your week lives only in this browser. An account is what makes it survive a lost phone.
        </p>
      }
    />
  );
}
