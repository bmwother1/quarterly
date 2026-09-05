'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { heronStore } from '@/lib/store';
import { hasContent } from '@/lib/sync-rule';

/**
 * Decides what the root URL means, which depends entirely on who is asking.
 *
 * Three audiences arrive at `/` and they want opposite things. A stranger who
 * typed the address needs to be told what this is. A student who set it up last
 * week wants their week, not a sales page. The installed app launches from here
 * too, so whatever this does is also what tapping the icon does.
 *
 * The rule: if there is a week to show, show it. Otherwise explain the product.
 *
 * **Why not just point `start_url` at `/week`,** which is what it used to do:
 * that hardcodes the answer and gets it wrong for anyone who installs before
 * setting anything up. It also meant the service worker's offline fallback
 * served the calendar to a stranger whose first visit happened to fail, which is
 * the worst available first impression. The decision belongs somewhere that can
 * see the state.
 *
 * `?home` forces the landing page, so the marketing copy stays reachable once
 * you have a plan. Without it there is no route back to your own front page.
 */
export function EntryRouter({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const state = useSyncExternalStore(
    heronStore.subscribe,
    heronStore.getSnapshot,
    heronStore.getServerSnapshot,
  );
  const hydrated = state !== heronStore.getServerSnapshot();

  // Same test the sync uses, deliberately shared. It had drifted: this one
  // ignored `availability`, so a student who set up classes and shifts and
  // nothing else was sent to the marketing page instead of their own week.
  const hasWeek = hasContent(state);

  const forcedHome =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('home');

  const redirecting = hydrated && hasWeek && !forcedHome;

  useEffect(() => {
    if (redirecting) router.replace('/week');
  }, [redirecting, router]);

  // Render nothing until the decision is made, and nothing while leaving.
  // Otherwise a returning student watches the landing page flash before being
  // moved off it, which reads as a misfired link rather than as a redirect.
  if (!hydrated || redirecting) return null;

  return <>{children}</>;
}
