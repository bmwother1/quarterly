'use client';

import { use, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useHeron } from '@/hooks/use-heron';
import { useNow } from '@/hooks/use-now';
import { usePlanMotion } from '@/hooks/use-plan-motion';
import { BlockCard, BlockRow } from '@/components/block-card';
import { DayBar, DayStats } from '@/components/day-bar';
import { keepCodes } from '@/components/course-name';
import { focusLabel } from '@/components/when';
import { breakdownForDay } from '@/lib/schedule/day';
import { categoryForCommitment, colorVar } from '@/lib/categories';
import { DEFAULT_TZ, addDays, fmtTime, localParts } from '@/lib/time';
import type { FixedEvent, StudyBlock } from '@/lib/types';

const TZ = DEFAULT_TZ;

type Item = { kind: 'block'; at: string; block: StudyBlock } | { kind: 'event'; at: string; event: FixedEvent };

/**
 * One day, in detail.
 *
 * Reached by tapping a day in the week grid or a bar in the workload chart.
 * It answers a different question from the week view: not "when is everything"
 * but "is this day survivable, and what is it actually made of". It still opens
 * on the block that matters, because that is the question a student who tapped
 * through from a notification is asking.
 */
export default function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = use(params);
  const { state, hydrated, complete, drop } = useHeron(TZ);
  const [now] = useState(() => new Date());
  const liveNow = useNow();

  const flowRef = useRef<HTMLDivElement>(null);
  usePlanMotion(flowRef, true, { shifts: true });

  const colorFor = useMemo(() => {
    // The same colours as the week, from category and shade. This view used to
    // assign its own from a separate palette in list order, so a run was green
    // on the week and orange here, and the colour stopped meaning anything.
    const map = new Map<string, string>();
    for (const c of state.courses) map.set(c.code, colorVar(c.category, c.shade));
    for (const c of state.commitments) map.set(c.title, colorVar(categoryForCommitment(c.category), c.shade));
    return (group: string) => map.get(group) ?? 'var(--accent)';
  }, [state.courses, state.commitments]);

  const day = useMemo(
    () => breakdownForDay(date, state.blocks, state.events, state.availability, TZ, colorFor),
    [date, state.blocks, state.events, state.availability, colorFor],
  );

  if (!hydrated) return <DaySkeleton />;

  const heading = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric',
  });
  const todayKey = localParts(now, TZ).dateKey;
  const isToday = date === todayKey;

  const focus = day.blocks.find((b) => b.status === 'planned') ?? null;
  const focusPast = focus ? new Date(focus.end) < now : false;
  const label = focus
    ? date > todayKey
      ? { lead: 'First', rest: fmtTime(focus.start, TZ) }
      : focusLabel(focus, focusPast, liveNow, todayKey, TZ)
    : null;

  // Blocks and fixed events on one time axis, rather than in two lists that
  // each had to be read separately to know what came after what.
  const items: Item[] = [
    ...day.blocks.filter((b) => b.id !== focus?.id).map((b) => ({ kind: 'block' as const, at: b.start, block: b })),
    ...day.events.map((e) => ({ kind: 'event' as const, at: e.start, event: e })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const nowIndex = isToday ? items.findIndex((i) => new Date(i.at) > liveNow) : -1;

  return (
    <main className="rise mx-auto max-w-2xl px-5 pb-12 pt-4 sm:pt-8">
      <nav className="-mx-3 flex items-center justify-between" aria-label="Days">
        <Link href="/week" className="btn-quiet">
          <Chevron dir="left" />
          Week
        </Link>
        <div className="flex">
          <Link href={`/day/${addDays(date, -1)}`} className="btn-quiet px-3" aria-label="Previous day">
            <Chevron dir="left" />
          </Link>
          <Link href={`/day/${addDays(date, 1)}`} className="btn-quiet px-3" aria-label="Next day">
            <Chevron dir="right" />
          </Link>
        </div>
      </nav>

      <header className="mt-2">
        <h1 className="text-heading font-semibold">{heading}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {isToday && <span className="font-medium text-[var(--accent)]">Today · </span>}
          {day.blocks.length === 0
            ? 'No study blocks'
            : `${day.blocks.length} block${day.blocks.length === 1 ? '' : 's'}`}
          {day.events.length > 0 && `, ${day.events.length} fixed`}
        </p>
      </header>

      <div ref={flowRef}>
        {focus && label && (
          <BlockCard
            key={focus.id}
            as="section"
            tracked
            className="enter mt-6"
            block={focus}
            tz={TZ}
            colour={colorFor(focus.course)}
            isPast={focusPast}
            primary
            label={
              <>
                <span className="font-semibold text-[var(--accent)]">{label.lead}</span>
                <span className="text-[var(--muted)]"> · {label.rest}</span>
              </>
            }
            onComplete={(outcome, minutes) => complete(focus.id, outcome, minutes)}
            onDrop={() => drop(focus.id)}
          />
        )}

        <section className="mt-8">
          <h2 className="border-b border-[var(--border)] pb-2 text-sm font-semibold">
            {focus ? (isToday ? 'The rest of today' : 'The rest of the day') : 'The day'}
          </h2>
          {items.length === 0 ? (
            <p className="py-3 text-sm text-[var(--muted)]">
              {focus ? 'Nothing else planned.' : 'Nothing planned.'}
              {day.freeMinutes > 60 && ` About ${Math.round(day.freeMinutes / 60)} hours are unscheduled.`}
            </p>
          ) : (
            <ol className="divide-y divide-[var(--border)]">
              {items.map((item, i) => (
                <DayItem
                  key={item.kind === 'block' ? item.block.id : item.event.id}
                  item={item}
                  showNow={i === nowIndex}
                  liveNow={liveNow}
                  colorFor={colorFor}
                  now={now}
                  complete={complete}
                  drop={drop}
                />
              ))}
              {isToday && nowIndex === -1 && <NowMarker at={liveNow} />}
            </ol>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold">Where the day goes</h2>
        <div className="mt-3">
          <DayBar day={day} />
        </div>
        <div className="mt-6">
          <DayStats day={day} />
        </div>
      </section>
    </main>
  );
}

function DayItem({
  item, showNow, liveNow, colorFor, now, complete, drop,
}: {
  item: Item;
  showNow: boolean;
  liveNow: Date;
  colorFor: (group: string) => string;
  now: Date;
  complete: ReturnType<typeof useHeron>['complete'];
  drop: ReturnType<typeof useHeron>['drop'];
}) {
  const marker = showNow ? <NowMarker at={liveNow} /> : null;

  if (item.kind === 'block') {
    const b = item.block;
    return (
      <>
        {marker}
        <BlockRow
          block={b}
          tz={TZ}
          colour={colorFor(b.course)}
          isPast={new Date(b.end) < now}
          onComplete={(outcome, minutes) => complete(b.id, outcome, minutes)}
          onDrop={() => drop(b.id)}
        />
      </>
    );
  }

  const e = item.event;
  return (
    <>
      {marker}
      <li className="grid grid-cols-[4rem_1fr] gap-x-3 py-3">
        <div className="text-sm leading-6">
          <div className="font-medium">{fmtTime(e.start, TZ)}</div>
          <div className="text-[var(--muted)]">{fmtTime(e.end, TZ)}</div>
        </div>
        <div className="min-w-0 border-l-3 pl-3" style={{ borderColor: colorVar(e.category, e.shade) }}>
          <p className="text-base font-medium">{keepCodes(e.title)}</p>
          <p className="text-sm text-[var(--muted)]">Fixed</p>
        </div>
      </li>
    </>
  );
}

/** The present, on the same axis as the rows around it. */
function NowMarker({ at }: { at: Date }) {
  return (
    <li className="grid grid-cols-[4rem_1fr] items-center gap-x-3 py-2" aria-label={`Now, ${fmtTime(at, TZ)}`}>
      <span className="text-sm font-medium text-[var(--accent)]">{fmtTime(at, TZ)}</span>
      <span className="relative h-0.5 rounded-full bg-[var(--accent)]" aria-hidden>
        <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      </span>
    </li>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={dir === 'left' ? 'M10 3.5L5.5 8l4.5 4.5' : 'M6 3.5L10.5 8 6 12.5'}
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function DaySkeleton() {
  const bar = 'rounded-sm bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]';
  return (
    <main className="mx-auto max-w-2xl px-5 pb-12 pt-4 sm:pt-8" aria-busy="true" aria-label="Loading the day">
      <div className="h-11" />
      <div className={`mt-2 h-8 w-72 ${bar}`} />
      <div className={`mt-2 h-4 w-32 ${bar}`} />
      <div className="mt-6 space-y-2 border-l-3 border-[var(--border)] pl-4">
        <div className={`h-4 w-44 ${bar}`} />
        <div className={`h-6 w-64 ${bar}`} />
        <div className={`h-12 w-full max-w-md ${bar}`} />
      </div>
    </main>
  );
}
