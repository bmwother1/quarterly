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
        No calendar links are saved on this device.{' '}
        <Link href="/import" className="underline underline-offset-4">Import a calendar</Link>{' '}
        to save one, or keep pasting each time. Both work.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <ul className="divide-y divide-[var(--border)]">
        {remembered.map((f) => (
          <li key={f.url} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.label}</p>
              <p className="truncate text-xs text-[var(--muted)]">
                {f.host} · saved {fmtDay(f.rememberedAt, tz)}
                {f.fetchedAt && ` · last checked ${fmtDay(f.fetchedAt, tz)}`}
              </p>
            </div>
            <button
              onClick={() => forget(f.url)}
              className="shrink-0 rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-sm"
            >
              Forget
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-[var(--faint)]">
        In this browser only. Not in your account, not on our server, not in your backup file.
      </p>
    </div>
  );
}
