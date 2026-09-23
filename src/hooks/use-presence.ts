'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps something on screen for the length of its exit animation.
 *
 * A sheet or a toast that unmounts the instant it is closed can only cut
 * away, never leave. This holds it for `exitMs` after `open` goes false,
 * with `leaving` set so it can play its exit, and then lets it go.
 *
 * The exit never delays input: callers make the leaving element ignore
 * pointer events, so whatever is underneath is usable the moment the close
 * is asked for.
 *
 * State is adjusted during render rather than in an effect, which is React's
 * documented pattern for deriving state from a prop, and avoids rendering one
 * frame with the old answer.
 */
export function usePresence(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  if (open && (!mounted || leaving)) {
    setMounted(true);
    setLeaving(false);
  }
  if (!open && mounted && !leaving) setLeaving(true);

  useEffect(() => {
    if (!leaving) return;
    // Reduced motion collapses the exit animation, so there is nothing to
    // wait for.
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, reduced ? 0 : exitMs);
    return () => clearTimeout(t);
  }, [leaving, exitMs]);

  return { mounted, leaving };
}
