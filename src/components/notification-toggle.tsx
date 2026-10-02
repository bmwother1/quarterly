'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from '@/supabase/push';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/supabase/client';

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

  /** A push to every device of this account, so the student sees one arrive now. */
  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
      const token = data.session?.access_token;
      if (!token) { setMessage('Sign in first.'); return; }
      const res = await fetch('/api/notify/test', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({})) as { sent?: number };
      setMessage(res.ok && body.sent
        ? `Sent to ${body.sent} device${body.sent === 1 ? '' : 's'}. It should arrive in a few seconds.`
        : res.status === 404 ? 'No device has notifications on yet.' : 'That did not send. Try turning notifications off and on.');
    } finally {
      setBusy(false);
    }
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

      {state === 'on' && signedIn && (
        <button onClick={() => { void sendTest(); }} disabled={busy} className="text-sm text-[var(--accent)] underline underline-offset-4 disabled:opacity-60">
          Send a test notification
        </button>
      )}

      {message && <p className="text-sm text-[var(--warn)]">{message}</p>}
    </div>
  );
}
