'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { onAuthChange, currentSession } from '@/supabase/auth';
import { syncAvailable } from '@/supabase/client';

/**
 * Who's signed in, if anyone.
 *
 * `loading` starts true and matters more than it looks. Without it the account
 * screen renders "signed out" for a beat before the stored session is read, so a
 * student who is already signed in watches the app briefly forget them. It also
 * covers the magic-link return, where the session appears a moment after load
 * once the code in the URL is exchanged.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  /**
   * Derived rather than set in the effect. There is nothing to wait for when
   * the project isn't configured, and setting it synchronously inside the
   * effect triggers a cascading render. Both env vars are inlined at build
   * time, so this is identical on the server and the client.
   */
  const [loading, setLoading] = useState(() => syncAvailable());

  useEffect(() => {
    if (!syncAvailable()) return;

    let alive = true;

    currentSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });

    // Also fires for the magic-link exchange, token refresh, and sign-out.
    const unsubscribe = onAuthChange((s) => {
      if (!alive) return;
      setSession(s);
      setLoading(false);
    });

    return () => { alive = false; unsubscribe(); };
  }, []);

  return {
    session,
    loading,
    email: session?.user.email ?? null,
    userId: session?.user.id ?? null,
    signedIn: Boolean(session),
    available: syncAvailable(),
  };
}
