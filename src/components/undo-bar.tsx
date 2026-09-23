'use client';

import { useEffect } from 'react';
import { Toast } from './toast';

/**
 * The undo prompt.
 *
 * Sits above the floating + so it can't be hidden behind it, and clears itself
 * after a few seconds. An undo offer that lingers stops reading as urgent and
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

  return <Toast message={label} action={{ label: 'Undo', onClick: onUndo }} />;
}
