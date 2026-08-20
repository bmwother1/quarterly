'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Sheet } from '@/components/sheet';

const LINKS = [
  { href: '/week', label: 'This week', hint: 'Your calendar' },
  { href: '/setup', label: 'Your week', hint: 'Sleep, work, commitments' },
  { href: '/canvas', label: 'Canvas', hint: 'Connect your course deadlines' },
  { href: '/settings', label: 'Settings', hint: 'Colours, backup, insights' },
];

/**
 * One menu button instead of a row of links.
 *
 * Four labels across the top is four things to read on every screen, on a phone
 * where they're already cramped. Collapsing them costs one tap and gives the
 * page its full width back — and the destination you're on is named in the
 * button itself, so the row wasn't carrying that information anyway.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const current = LINKS.find((l) => l.href === pathname);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div
          className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-5 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <Link href="/week" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-5 w-5 items-end gap-[2px]" aria-hidden>
              <span className="h-2.5 w-1 rounded-sm bg-[var(--border-strong)]" />
              <span className="h-5 w-1 rounded-sm bg-[var(--accent)]" />
              <span className="h-3.5 w-1 rounded-sm bg-[var(--border-strong)]" />
            </span>
            Quarterly
          </Link>

          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
            className="-mr-2 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            {/* Naming the current page here is what makes losing the link row costless. */}
            <span className="hidden sm:inline">{current?.label ?? 'Menu'}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <Sheet open={open} title="Menu" onClose={() => setOpen(false)}>
        <nav className="flex flex-col gap-1">
          {LINKS.map((l) => {
            const active = l.href === pathname;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                // Closed on the click rather than by watching the path: the menu
                // shuts because you chose something, not as a side effect.
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors ${
                  active ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--raised)]'
                }`}
              >
                <span>
                  <span className={`block font-medium ${active ? 'text-[var(--accent)]' : ''}`}>
                    {l.label}
                  </span>
                  <span className="block text-sm text-[var(--muted)]">{l.hint}</span>
                </span>
                {active && (
                  <span className="text-xs uppercase tracking-wide text-[var(--accent)]">here</span>
                )}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/privacy"
          onClick={() => setOpen(false)}
          className="mt-4 block px-3 text-sm text-[var(--faint)] underline underline-offset-4"
        >
          Privacy
        </Link>
      </Sheet>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)]">
      <div
        className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-[var(--faint)]"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <span>Quarterly · free for students</span>
        <nav className="flex gap-4">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--muted)]">
            Privacy
          </Link>
          <a
            href="https://github.com/bmwother1/quarterly"
            className="underline underline-offset-4 hover:text-[var(--muted)]"
            rel="noreferrer"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
