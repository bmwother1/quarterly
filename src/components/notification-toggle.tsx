'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from '@/supabase/push';
import { useAuth } from '@/hooks/use-auth';

/**
 * Turning notifications on, and saying honestly why they might not work.
 *
 * Most of this component is the failure cases, and that is the right ratio. The
 * happy path is one tap. Everything else is a student on an iPhone in a Safari
 * tab, where the Push API does not exist at all and the failure is completely
 * silent: no error, no prompt, nothing ever arrives. Told "your browser is not
 * supported" they would reasonably give up. Told to add it to the home screen
 * they are thirty seconds from it working.
 */
export function NotificationToggle() {
  const { signedIn } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void pushState().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [signedIn]);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    if (state === 'on') {
      await disablePush();
      setState('off');
    } else {
      const result = await enablePush();
      if (result.ok) setState('on');
      else { setState(result.state); setMessage(result.message); }
    }
    setBusy(false);
  }

  if (state === null) return <div className="min-h-10" aria-busy="true" />;

  if (state === 'needs-install') {
    return (
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p className="text-base font-semibold text-[var(--ink)]">Add Heron to your home screen first.</p>
        <p>
          On iPhone, notifications only work from the installed app, not from a Safari tab.
          Tap Share, then <strong className="text-[var(--ink)]">Add to Home Screen</strong>, and
          open it from there.
        </p>
        <p>
          This is an Apple rule rather than something we can work around.
        </p>
      </div>
    );
  }

  if (state === 'unsupported') {
    return (
      <p className="text-sm text-[var(--muted)]">
        This browser can&rsquo;t do notifications. Your week still works exactly the same.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        One a day at most, always carrying the reason the block is there. Never a streak, never a
        nag about a day you missed.
      </p>

      {!signedIn && state !== 'on' && (
        <p className="text-sm text-[var(--muted)]">
          Sign in above first. A notification has to know whose week it is about.
        </p>
      )}

      <button
        onClick={() => { void toggle(); }}
        disabled={busy || (!signedIn && state !== 'on')}
        // Secondary either way: signing in, above, is this page's one primary.
        className="btn-secondary"
      >
        {busy ? 'Just a moment…' : state === 'on' ? 'Turn notifications off' : 'Turn notifications on'}
      </button>

      {state === 'on' && (
        <p className="text-sm text-[var(--muted)]">
          On for this device. Each device is separate, so a phone and a laptop are asked
          independently.
        </p>
      )}

      {message && <p className="text-sm text-[var(--warn)]">{message}</p>}
    </div>
  );
}
