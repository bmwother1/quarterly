/**
 * How a single day is actually spent.
 *
 * Part-to-whole, so the form is a stacked bar rather than a pie: comparing
 * segment lengths along one axis is a far easier read than comparing wedge
 * angles, and it survives being 6px tall on a phone, which a pie does not.
 *
 * The whole here is the waking day, not 24 hours. Sleep is shown because it
 * explains where the rest of the time went, but a bar that's a third sleep
 * every day tells the student nothing they can act on.
 */

import type { Availability, BusyBlock, FixedEvent, StudyBlock } from '../types.ts';
import { localParts, weekdayOf, zonedInstant } from '../time.ts';

export interface DaySegment {
  key: string;
  label: string;
  minutes: number;
  color: string;
  /** Course and commitment time is chosen; the rest is context. */
  kind: 'work' | 'fixed' | 'sleep' | 'free';
}

export interface DayBreakdown {
  dateKey: string;
  segments: DaySegment[];
  /** Minutes in the waking day — the denominator for every share. */
  wakingMinutes: number;
  plannedMinutes: number;
  fixedMinutes: number;
  freeMinutes: number;
  doneMinutes: number;
  blocks: StudyBlock[];
  events: FixedEvent[];
}

function minutesOf(a: { start: string; end: string }): number {
  return (new Date(a.end).getTime() - new Date(a.start).getTime()) / 60_000;
}

/** Busy blocks for one weekday, wrapping past midnight onto the next day. */
function busyFor(busy: BusyBlock[], weekday: number) {
  const out: Array<{ startMin: number; endMin: number; kind: BusyBlock['kind']; label: string }> = [];
  for (const b of busy) {
    const wraps = b.endMin <= b.startMin;
    if (b.day === weekday) out.push({ startMin: b.startMin, endMin: wraps ? 1440 : b.endMin, kind: b.kind, label: b.label });
    if (wraps && (b.day + 1) % 7 === weekday) out.push({ startMin: 0, endMin: b.endMin, kind: b.kind, label: b.label });
  }
  return out;
}

export function breakdownForDay(
  dateKey: string,
  blocks: StudyBlock[],
  events: FixedEvent[],
  availability: Availability,
  tz: string,
  colorFor: (group: string) => string,
): DayBreakdown {
  const weekday = weekdayOf(dateKey);
  const dayBlocks = blocks
    .filter((b) => localParts(new Date(b.start), tz).dateKey === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start));
  const dayEvents = events
    .filter((e) => localParts(new Date(e.start), tz).dateKey === dateKey)
    .sort((a, b) => a.start.localeCompare(b.start));

  const busy = busyFor(availability.busy, weekday);
  const sleepMinutes = busy.filter((b) => b.kind === 'sleep').reduce((s, b) => s + (b.endMin - b.startMin), 0);
  const fixedRecurring = busy.filter((b) => b.kind !== 'sleep');

  const wakingMinutes = Math.max(60, 1440 - sleepMinutes);

  // Study time grouped by course or commitment, because "3 hours of work" is
  // less useful than "2 of CHEM and 1 of the essay".
  const byGroup = new Map<string, number>();
  for (const b of dayBlocks) {
    if (b.status === 'skipped') continue;
    byGroup.set(b.course, (byGroup.get(b.course) ?? 0) + b.minutes);
  }

  const fixedMinutes =
    fixedRecurring.reduce((s, b) => s + (b.endMin - b.startMin), 0) +
    dayEvents.reduce((s, e) => s + minutesOf(e), 0);

  const plannedMinutes = [...byGroup.values()].reduce((s, m) => s + m, 0);
  const freeMinutes = Math.max(0, wakingMinutes - fixedMinutes - plannedMinutes);

  const segments: DaySegment[] = [
    ...[...byGroup]
      .sort((a, b) => b[1] - a[1])
      .map(([group, minutes]) => ({
        key: group, label: group, minutes, color: colorFor(group), kind: 'work' as const,
      })),
  ];

  if (fixedMinutes > 0) {
    const label = dayEvents.length > 0 && fixedRecurring.length === 0
      ? dayEvents[0].title
      : 'Class, work, other';
    segments.push({ key: 'fixed', label, minutes: fixedMinutes, color: 'var(--ctx-fixed)', kind: 'fixed' });
  }
  if (freeMinutes > 0) {
    segments.push({ key: 'free', label: 'Unscheduled', minutes: freeMinutes, color: 'var(--ctx-free)', kind: 'free' });
  }

  return {
    dateKey,
    segments,
    wakingMinutes,
    plannedMinutes,
    fixedMinutes,
    freeMinutes,
    doneMinutes: dayBlocks
      .filter((b) => b.status === 'done' || b.status === 'partial')
      .reduce((s, b) => s + (b.actualMinutes ?? b.minutes), 0),
    blocks: dayBlocks,
    events: dayEvents,
  };
}

/** The instant a day starts, for links and comparisons. */
export function dayStart(dateKey: string, tz: string): Date {
  return zonedInstant(dateKey, 0, tz);
}
