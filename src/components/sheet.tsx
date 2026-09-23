'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '@/hooks/use-presence';

const EXIT_MS = 160;

/**
 * A bottom sheet on a phone, a centred panel on a laptop.
 *
 * Same component either way: the difference is entirely CSS, because the
 * behaviour a person expects is identical. It covers, it takes focus, escape
 * and the backdrop close it.
 *
 * Rendered into <body>. It used to render wherever it was declared, which on
 * /week was inside a <main> carrying a transform, so the "fixed" sheet was
 * positioned against the page and opened halfway down it.
 *
 * It slides up on a phone and settles in on a laptop, and leaves faster than
 * it arrives. While leaving it ignores the pointer, so a tap straight after
 * closing reaches the page instead of the sheet's ghost.
 */
export function Sheet({
  open, title, onClose, children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, leaving } = usePresence(open, EXIT_MS);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    // Focus moves in so a keyboard user isn't left behind on the page below,
    // and the page below can't scroll under an open sheet.
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6 ${
        leaving ? 'pointer-events-none' : ''
      }`}
    >
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 active:transform-none"
        style={{
          animation: leaving
            ? `fade-out ${EXIT_MS}ms var(--ease-exit) forwards`
            : 'fade-in var(--dur-enter) var(--ease) backwards',
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="sheet-panel relative max-h-[88vh] w-full overflow-y-auto rounded-t-md border border-[var(--border)] bg-[var(--surface)] shadow-overlay outline-none sm:max-w-lg sm:rounded-md"
        data-leaving={leaving || undefined}
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)] py-2 pl-4 pr-2">
          <h2 className="text-base font-medium">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** The floating add button. One tap, from the screen you're already on. */
export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add an event or task"
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-float sm:right-6"
      // Sits above the phone tab bar; back down to the corner on a laptop,
      // where there is no tab bar to clear.
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + var(--fab-lift))',
        animation: 'pop-in var(--dur-enter) var(--ease) backwards',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
