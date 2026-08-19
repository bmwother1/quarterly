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
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Quarterly
        </Link>
        <nav className="flex gap-4 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}
              >
                {l.label}
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
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-[var(--faint)]">
        <span>Quarterly · free for students</span>
        <nav className="flex gap-4">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-[var(--muted)]">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
