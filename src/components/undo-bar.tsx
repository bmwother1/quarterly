'use client';

import { useEffect } from 'react';

/**
 * The undo prompt.
 *
 * Sits above the floating + so it can't be hidden behind it, and clears itself
 * after a few seconds — an undo offer that lingers stops reading as urgent and
 * starts reading as clutter.
 */
export function UndoBar({
  label, onUndo, onDismiss,
}: {
  label: string | null;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!label) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [label, onDismiss]);

  if (!label) return null;

  return (
    <div
      role="status"
      className="rise fixed inset-x-0 z-40 mx-auto flex w-fit items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--ink)] px-4 py-2.5 text-sm text-[var(--bg)] shadow-[var(--shadow-md)]"
      // Above the + which is itself above the tab bar.
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--fab-lift) + 4rem)' }}
    >
      <span>{label}</span>
      <button
        onClick={onUndo}
        className="font-medium underline underline-offset-4"
      >
        Undo
      </button>
    </div>
  );
}
