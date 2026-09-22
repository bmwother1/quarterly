'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the viewport is phone-width.
 *
 * `640px` is Tailwind's `sm`, so this hook and the `sm:` utilities always
 * disagree in the same places, which is the only way a JS breakpoint and a CSS
 * one stay honest with each other.
 *
 * Written as an external store rather than an effect for the reason the theme
 * store is: setting state inside an effect to match the environment renders the
 * wrong thing first and then corrects it, and ESLint has caught that pattern in
 * this codebase three times. `useSyncExternalStore` gives React a server answer
 * and a client answer and lets it reconcile them itself.
 *
 * The server answer is "not narrow". A server has no viewport, so this is a
 * guess either way; the desktop layout is the safer one to be wrong about,
 * because a wide layout on a phone is ugly and a narrow layout on a desktop
 * looks broken.
 */
const QUERY = '(max-width: 639px)';

let mq: MediaQueryList | null = null;

function query(): MediaQueryList {
  mq ??= window.matchMedia(QUERY);
  return mq;
}

function subscribe(onChange: () => void): () => void {
  const m = query();
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => query().matches, () => false);
}
