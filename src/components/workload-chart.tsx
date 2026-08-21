'use client';

import Link from 'next/link';
import type { Assignment } from '@/lib/types';
import { DEFAULT_TZ } from '@/lib/time';

export interface WorkloadWeek {
  weekStart: string;
  count: number;
  minutes: number;
  hasExam: boolean;
}

/**
 * The shape of a quarter, as a bar per week.
 *
 * This is the single most persuasive thing the product does before a student
 * has entered anything. Twenty minutes of setup replaces a semester of manual
 * data entry, and the crunch weeks are visible immediately.
 */
export function WorkloadChart({ weeks }: { weeks: WorkloadWeek[] }) {
  const upcoming = weeks.slice(0, 12);
  if (upcoming.length === 0) return null;

  const peak = Math.max(...upcoming.map((w) => w.count), 1);

  return (
    <div className="space-y-1.5">
      {upcoming.map((w) => {
        const pct = Math.max(4, Math.round((w.count / peak) * 100));
        const label = new Date(w.weekStart + 'T12:00:00Z').toLocaleDateString('en-US', {
          timeZone: 'UTC', month: 'short', day: 'numeric',
        });
        return (
          <Link
            key={w.weekStart}
            href={`/day/${w.weekStart}`}
            className="flex items-center gap-3 rounded text-sm transition-colors hover:bg-[var(--raised)]"
          >
            <span className="w-16 shrink-0 tabular-nums text-[var(--faint)]">{label}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-[var(--border)]/40">
              <div
                className="h-full rounded-sm transition-[width]"
                style={{
                  width: `${pct}%`,
                  background: w.hasExam ? 'var(--warn)' : 'var(--accent)',
                  opacity: w.hasExam ? 1 : 0.75,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-right tabular-nums text-[var(--muted)]">{w.count}</span>
            {w.hasExam && <span className="w-10 shrink-0 text-xs text-[var(--warn)]">exam</span>}
            {!w.hasExam && <span className="w-10 shrink-0" />}
          </Link>
        );
      })}
      <p className="pt-2 text-xs text-[var(--faint)]">
        The tall bars are the weeks students lose. Work backward from those.
      </p>
    </div>
  );
}

/** Course chips, coloured consistently with everything else in the app. */
export function CourseList({ courses }: { courses: Array<{ code: string; fullName: string; color: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {courses.map((c) => (
        <span
          key={c.code}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-sm"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
          {c.code}
        </span>
      ))}
    </div>
  );
}

/**
 * The next handful of deadlines, so the feed is obviously real and correct.
 *
 * `now` is passed in rather than read from the clock. Calling Date.now() during
 * render is impure: it can differ between the server and client passes and
 * produce a hydration mismatch, and React's rules-of-hooks lint rejects it.
 */
export function UpcomingList({
  assignments, now, tz = DEFAULT_TZ,
}: { assignments: Assignment[]; now: number; tz?: string }) {
  const next = assignments
    .filter((a) => new Date(a.due).getTime() >= now)
    .slice(0, 8);

  if (next.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Nothing upcoming in this feed.</p>;
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {next.map((a) => (
        <li key={a.id} className="flex items-baseline gap-3 py-2 text-sm">
          <span className="w-14 shrink-0 text-[var(--faint)] tabular-nums sm:w-24">
            {new Date(a.due).toLocaleDateString('en-US', {
              timeZone: tz, month: 'short', day: 'numeric',
            })}
          </span>
          <span className="w-20 shrink-0 text-[var(--muted)]">{a.course}</span>
          <span className="min-w-0 flex-1 truncate">{a.title}</span>
          {/* The work type is useful context on a laptop and clutter on a phone. */}
          <span className="hidden shrink-0 text-xs text-[var(--faint)] sm:inline">{a.kind}</span>
        </li>
      ))}
    </ul>
  );
}
