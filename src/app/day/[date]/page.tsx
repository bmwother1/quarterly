'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuarterly } from '@/hooks/use-quarterly';
import { BlockCard } from '@/components/block-card';
import { DayBar, DayStats } from '@/components/day-bar';
import { breakdownForDay } from '@/lib/schedule/day';
import { seriesVar } from '@/lib/series';
import { DEFAULT_TZ, addDays, fmtTime, localParts } from '@/lib/time';

const TZ = DEFAULT_TZ;

/**
 * One day, in detail.
 *
 * Reached by tapping a day in the week grid or a bar in the workload chart.
 * It answers a different question from the week view: not "when is everything"
 * but "is this day survivable, and what is it actually made of".
 */
export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const { state, hydrated, complete, drop } = useQuarterly(TZ);
  const [now] = useState(() => new Date());

  const colorFor = useMemo(() => {
    // Fixed assignment order, so a course keeps its colour when another is
    // filtered out or removed.
    const order = [
      ...state.courses.map((c) => c.code),
      ...state.commitments.map((c) => c.title),
    ];
    return (group: string) => {
      const i = order.indexOf(group);
      return seriesVar(i === -1 ? 0 : i);
    };
  }, [state.courses, state.commitments]);

  const day = useMemo(
    () => breakdownForDay(date, state.blocks, state.events, state.availability, TZ, colorFor),
    [date, state.blocks, state.events, state.availability, colorFor],
  );

  if (!hydrated) {
    return <main className="mx-auto max-w-2xl px-5 py-12"><p className="text-[var(--muted)]">Loading…</p></main>;
  }

  const heading = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric',
  });
  const isToday = date === localParts(now, TZ).dateKey;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <nav className="mb-6 flex items-center justify-between gap-3 text-sm">
        <Link href={`/day/${addDays(date, -1)}`} className="text-[var(--muted)] hover:text-[var(--ink)]">
          ← Previous
        </Link>
        <Link href="/week" className="text-[var(--muted)] underline underline-offset-4">
          Back to the week
        </Link>
        <Link href={`/day/${addDays(date, 1)}`} className="text-[var(--muted)] hover:text-[var(--ink)]">
          Next →
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          {heading}
          {isToday && <span className="ml-2 align-middle text-sm font-normal text-[var(--accent)]">today</span>}
        </h1>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium">Where the day goes</h2>
        <DayBar day={day} />
        <div className="mt-4">
          <DayStats day={day} />
        </div>
      </section>

      {day.events.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-medium">Fixed</h2>
          <ul className="divide-y divide-[var(--border)]">
            {day.events.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-[var(--faint)]">
                  {fmtTime(e.start, TZ)}–{fmtTime(e.end, TZ)}
                </span>
                <span className="min-w-0 flex-1 truncate">{e.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">
          {day.blocks.length > 0 ? 'Your blocks' : 'Nothing scheduled'}
        </h2>
        {day.blocks.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No study blocks on this day. {day.freeMinutes > 60 && `About ${Math.round(day.freeMinutes / 60)} hours are unscheduled.`}
          </p>
        ) : (
          <div className="space-y-2">
            {day.blocks.map((b) => (
              <BlockCard
                key={b.id}
                block={b}
                tz={TZ}
                colour={colorFor(b.course)}
                isPast={new Date(b.end) < now}
                onComplete={(outcome, minutes) => complete(b.id, outcome, minutes)}
                onDrop={() => drop(b.id)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
