'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/week', label: 'This week' },
  { href: '/setup', label: 'Set up' },
  { href: '/canvas', label: 'Canvas' },
];

/**
 * Persistent navigation.
 *
 * Its absence was a real problem: landing on the Canvas screen with no visible
 * route to setup made the app look like it only did one thing, and that one
 * thing is the thing that doesn't work in August.
 */
export function SiteHeader() {
  const pathname = usePathname();

  return (
    // Sticky and translucent: on a phone the nav is the only way back, and it
    // shouldn't cost a scroll to the top to reach it.
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-5 w-5 items-end gap-[2px]" aria-hidden>
            <span className="h-2.5 w-1 rounded-sm bg-[var(--border-strong)]" />
            <span className="h-5 w-1 rounded-sm bg-[var(--accent)]" />
            <span className="h-3.5 w-1 rounded-sm bg-[var(--border-strong)]" />
          </span>
          Quarterly
        </Link>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1 transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[13px] h-[2px] rounded-full bg-[var(--accent)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
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
