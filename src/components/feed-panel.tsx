'use client';

import Link from 'next/link';
import { useFeed } from '@/hooks/use-feed';
import { fmtDay } from '@/lib/time';

/**
 * Revocation, where a student would look for it.
 *
 * A remembered credential the student cannot find is not consent, it is a
 * setting they agreed to once and can never take back. So every saved link is
 * listed here with its own Forget, named by site and dated, so the thing being
 * revoked is recognisable rather than abstract.
 */
export function FeedPanel({ tz }: { tz: string }) {
  const { remembered, forget } = useFeed(tz);

  if (remembered.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No calendar links are saved.{' '}
        <Link
          href="/import"
          className="text-[var(--ink)] underline decoration-[var(--border-strong)] underline-offset-4 hover:decoration-[var(--ink)]"
        >
          Import a calendar
        </Link>{' '}
        to save one, or keep pasting each time. Both work.
      </p>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {remembered.map((f) => (
          <li key={f.url} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">{f.label}</p>
              <p className="truncate text-sm text-[var(--muted)]">
                {f.host} · saved {fmtDay(f.rememberedAt, tz)}
                {f.fetchedAt && ` · last checked ${fmtDay(f.fetchedAt, tz)}`}
              </p>
            </div>
            <button onClick={() => forget(f.url)} className="btn-secondary shrink-0">
              Forget
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-[var(--muted)]">
        In this browser only. Not in your account, not on our server, not in your backup file.
      </p>
    </div>
  );
}
