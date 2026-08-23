'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ensureProfile, startAutoPush, syncOnSignIn } from '@/supabase/sync';
import { logOpen } from '@/supabase/events';

/**
 * The one place sign-in turns into something happening.
 *
 * Mounted once in the root layout rather than per page, because both jobs here
 * must run exactly once per session: syncing twice is harmless but wasteful, and
 * logging "opened" twice would put noise into the only table that can answer
 * whether students come back.
 *
 * Renders nothing. Every failure inside is swallowed, because a student's week
 * has never depended on a network and must not start now: someone signed out, or
 * on a train, or with a Supabase outage, gets exactly the product they had
 * before any of this existed.
 */
export function SyncBoundary() {
  const { userId, loading } = useAuth();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !userId) return;
    // Auth state can fire more than once for the same user, notably on token
    // refresh. Keyed by id so a genuine account switch still runs.
    if (doneFor.current === userId) return;
    doneFor.current = userId;

    let stopAutoPush: (() => void) | null = null;

    void (async () => {
      try {
        await ensureProfile(userId);
        const outcome = await syncOnSignIn(userId);
        // Only start pushing once the initial reconciliation has settled. A
        // conflict means both copies still differ and neither has been chosen,
        // so pushing would quietly resolve it in favour of this device, which
        // is precisely what the conflict state exists to avoid.
        if (outcome !== 'conflict') stopAutoPush = startAutoPush(userId);
      } catch {
        // Deliberately silent. Nothing here is worth interrupting a student for.
      }
      logOpen();
    })();

    return () => { stopAutoPush?.(); };
  }, [userId, loading]);

  return null;
}
