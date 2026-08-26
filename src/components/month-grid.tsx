'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { breakdownForDay, dominantCategory } from '@/lib/schedule/day';
import { CATEGORY_META, colorVar, type Category } from '@/lib/categories';
import { localParts } from '@/lib/time';
import type { Availability, FixedEvent, StudyBlock } from '@/lib/types';

/**
 * A month at a glance: one thin bar per day, showing how much of it is spoken
 * for and what kind of time it mostly is.
 *
 * **Why a bar and not a count.** Six one-hour lectures and one six-hour deadline
 * are the same number of events and nothing like the same week. A count would
 * make the calmest day look identical to the worst one, which is exactly the
 * lie every other planner tells. The bar is minutes.
 *
 * **Why one colour per day and not one per course.** With five or six courses a
 * month grid becomes a mosaic that nobody can read at 40px a cell. Individual
 * course distinction stays in the week and day views, where blocks are big
 * enough to carry a label. Here the only question worth answering is what kind
 * of day it is.
 *
 * **Where the numbers come from.** `breakdownForDay`, the same function the day
 * view uses. Deriving a second workload figure here would be a second answer to
 * a question already answered, and the two would drift the first time either
 * one changed.
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Monday-anchored, matching the week grid and the rest of the app. */
function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(1 - lead);

  const weeks: string[][] = [];
  const cursor = new Date(start);
  // Six rows always. A grid that changes height between months makes the page
  // jump on every swipe, which reads as a glitch rather than as a month change.
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function MonthGrid({
  blocks, events, availability, tz, colorFor, categoryFor,
}: {
  blocks: StudyBlock[];
  events: FixedEvent[];
  availability: Availability;
  tz: string;
  colorFor: (group: string) => string;
  categoryFor: (group: string) => Category;
}) {
  const router = useRouter();
  const today = useMemo(() => localParts(new Date(), tz).dateKey, [tz]);
  const [offset, setOffset] = useState(0);

  /**
   * Swipe, kept deliberately crude.
   *
   * Touch start and end only, with no pointer capture and no drag preview.
   * Richer gestures in this codebase have twice been silently broken in ways no
   * test caught, so this does the least that works and is confirmed by hand on
   * a real device rather than proven to a headless browser.
   *
   * The vertical guard matters more than the threshold: without it, scrolling
   * the page past the grid flips the month.
   */
  const touch = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    setOffset((o) => o + (dx < 0 ? 1 : -1));
  }

  const { year, month } = useMemo(() => {
    const base = new Date(`${today}T00:00:00Z`);
    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + offset);
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
  }, [today, offset]);

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);

  /**
   * One breakdown per visible cell, 42 of them.
   *
   * Memoised on the inputs rather than recomputed per render, because a swipe
   * re-renders and the scheduler's own full-quarter plan takes ~21ms. Doing this
   * work on every frame of a drag would be the one place this view could feel
   * slow.
   */
  const days = useMemo(() => {
    const out = new Map<string, { load: number; category: Category | null; minutes: number }>();
    for (const week of weeks) {
      for (const dateKey of week) {
        const b = breakdownForDay(dateKey, blocks, events, availability, tz, colorFor, categoryFor);
        const spoken = b.plannedMinutes + b.fixedMinutes;
        out.set(dateKey, {
          // Share of the waking day already committed, capped: a day that is
          // 130% booked is still a full bar, and the honest signal is the
          // "didn't fit" list rather than a bar that overflows its cell.
          load: Math.min(1, spoken / Math.max(1, b.wakingMinutes)),
          category: dominantCategory(b.byCategory),
          minutes: spoken,
        });
      }
    }
    return out;
  }, [weeks, blocks, events, availability, tz, colorFor, categoryFor]);

  const shown = new Set(
    weeks.flat().filter((k) => Number(k.slice(5, 7)) - 1 === month),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous month"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]"
        >
          ‹
        </button>
        <h2 className="text-sm font-medium">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Next month"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)]"
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--faint)]">
        {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div
        className="grid grid-cols-7 gap-1 touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {weeks.flat().map((dateKey) => {
          const d = days.get(dateKey)!;
          const inMonth = shown.has(dateKey);
          const isToday = dateKey === today;
          const hours = d.minutes / 60;

          return (
            <button
              key={dateKey}
              onClick={() => router.push(`/day/${dateKey}`)}
              // Days outside the month stay tappable but recede. Hiding them
              // leaves ragged holes; dimming keeps the grid a grid.
              className={`relative flex h-14 flex-col justify-between rounded-lg border p-1.5 text-left transition-colors ${
                isToday
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : 'border-[var(--border)] hover:bg-[var(--raised)]'
              } ${inMonth ? '' : 'opacity-35'}`}
              aria-label={
                d.minutes > 0
                  ? `${dateKey}, ${hours.toFixed(1)} hours, mostly ${d.category ? CATEGORY_META[d.category].label : 'unplanned'}`
                  : `${dateKey}, nothing planned`
              }
            >
              <span className={`text-[11px] ${isToday ? 'font-semibold text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                {Number(dateKey.slice(8, 10))}
              </span>

              {/* The bar. Always present as a track so the grid keeps its
                  rhythm on an empty day rather than collapsing. */}
              <span className="block h-1.5 w-full rounded-full bg-[var(--raised)]" aria-hidden>
                {d.category && d.load > 0 && (
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(8, d.load * 100)}%`,
                      background: colorVar(d.category, 0),
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  // Sleep is deliberately absent: it is excluded from dominance, so it can
  // never colour a bar, and listing it would promise something that never
  // appears.
  const shown: Category[] = ['deadline', 'focus', 'class', 'work', 'personal'];
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[var(--muted)]">
      {shown.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: colorVar(c, 0) }}
            aria-hidden
          />
          {CATEGORY_META[c].label}
        </span>
      ))}
    </div>
  );
}
