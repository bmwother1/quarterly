'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '@/hooks/use-presence';

const EXIT_MS = 120;

/**
 * The one way the app says "done" or "here's what I moved".
 *
 * There used to be four of these, written separately: the undo bar, the
 * moved notice on /week, and a saved flash on each of /setup and /settings.
 * The last two sat at `bottom-4` under a `z-30` tab bar, so on a phone they
 * were drawn behind it and never seen.
 *
 * Rendered into <body> so no ancestor's layout can capture it, and placed
 * above the + and the tab bar on every screen, whether or not those are
 * there, so it is always in the same spot.
 */
export function Toast({
  message, action,
}: {
  /** Null hides it. The last message stays visible while it leaves. */
  message: string | null;
  action?: { label: string; onClick: () => void };
}) {
  const { mounted, leaving } = usePresence(message !== null, EXIT_MS);
  const [shown, setShown] = useState(message);
  if (message !== null && message !== shown) setShown(message);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="status"
      className={`fixed inset-x-0 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-[var(--ink)] py-2 pl-4 text-sm text-[var(--bg)] shadow-float ${
        action ? 'pr-2' : 'pr-4'
      } ${leaving ? 'pointer-events-none' : ''}`}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + var(--fab-lift) + 4.5rem)',
        animation: leaving
          ? `pop-out ${EXIT_MS}ms var(--ease-exit) forwards`
          : 'pop-in var(--dur-enter) var(--ease) backwards',
      }}
    >
      <span className="min-w-0">{shown}</span>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 rounded-full px-3 py-1 font-medium text-[var(--bg)] underline underline-offset-4"
        >
          {action.label}
        </button>
      )}
    </div>,
    document.body,
  );
}
