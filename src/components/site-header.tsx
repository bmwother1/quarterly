'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navigation: inline on a laptop, a bottom tab bar on a phone.
 *
 * This replaced a hamburger menu, on evidence rather than taste. Bottom tab
 * bars lift engagement up to 58% over hidden menus, feature discovery rises
 * 30%+ when apps switch, and users are 2–3× less likely to find anything behind
 * a hamburger at all. The ergonomic half decides it for this product
 * specifically: a hamburger sits top-right, the hardest place to reach
 * one-handed, and a student checking their next block on the walk to class has
 * one thumb.
 *
 * Three tabs, which is inside the three-to-five sweet spot. Canvas isn't one of
 * them — it's a once-ever setup action, so it lives inside Plan.
 */

const TABS = [
  {
    href: '/week',
    label: 'Week',
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 3v3M16 3v3" />
        <rect x="6.5" y="12.5" width="4" height="5" rx="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    href: '/setup',
    label: 'Plan',
    icon: (
      <>
        <path d="M4 7h10M4 12h16M4 17h7" />
        <circle cx="18" cy="7" r="2.2" />
        <circle cx="14" cy="17" r="2.2" />
      </>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
      </>
    ),
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div
        className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-5 py-3"
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

        {/* Laptops get the links inline; phones get them at the bottom instead. */}
        <nav className="hidden gap-5 text-sm sm:flex">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`relative py-1 transition-colors ${
                  active ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[13px] h-[2px] rounded-full bg-[var(--accent)]" />
                )}
              </Link>
            );
          })}
          <Link href="/canvas" className="py-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]">
            Canvas
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** The phone tab bar. Fixed to the bottom, where the thumb already is. */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]/92 backdrop-blur-md sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
              }`}
            >
              <Icon>{t.icon}</Icon>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)]">
      <div
        className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-[var(--faint)]"
        // Clears the tab bar on a phone so the last row isn't sitting under it.
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
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
