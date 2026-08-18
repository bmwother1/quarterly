/**
 * Free-time discovery.
 *
 * Turns a weekly availability pattern into concrete open intervals over the
 * planning horizon. Everything the student declared busy — class, sleep, work,
 * standing commitments — is subtracted, and so is any time already in the past.
 */

import type { Availability, BusyBlock } from '../types.ts';
import { DEFAULT_TZ, addDays, localParts, weekdayOf, zonedInstant } from '../time.ts';

export interface FreeSlot {
  /** YYYY-MM-DD in the student's zone. */
  dateKey: string;
  start: Date;
  end: Date;
  minutes: number;
}

interface Interval { start: number; end: number }

/**
 * Expand busy blocks for one weekday, splitting anything that wraps past
 * midnight (a sleep block of 23:00–07:00, typically) onto the following day.
 */
function busyForDay(busy: BusyBlock[], weekday: number): Interval[] {
  const out: Interval[] = [];

  for (const b of busy) {
    const wraps = b.endMin <= b.startMin;

    if (b.day === weekday) {
      out.push({ start: b.startMin, end: wraps ? 1440 : b.endMin });
    }
    // The tail of yesterday's wrapping block lands on today.
    if (wraps && (b.day + 1) % 7 === weekday) {
      out.push({ start: 0, end: b.endMin });
    }
  }

  return mergeIntervals(out);
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];

  for (const cur of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push({ ...cur });
  }
  return out;
}

/** Everything inside [from, to] that isn't covered by `blocked`. */
export function subtract(from: number, to: number, blocked: Interval[]): Interval[] {
  const out: Interval[] = [];
  let cursor = from;

  for (const b of blocked) {
    if (b.end <= cursor) continue;
    if (b.start >= to) break;
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, to) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push({ start: cursor, end: to });

  return out.filter((i) => i.end > i.start);
}

/** Round up to the next quarter hour. Blocks that start at 2:07 look broken. */
function roundUpTo(minutes: number, step = 15): number {
  return Math.ceil(minutes / step) * step;
}

export function freeSlots(
  availability: Availability,
  from: Date,
  days: number,
  tz = DEFAULT_TZ,
  minSlotMinutes = 25,
): FreeSlot[] {
  const startParts = localParts(from, tz);
  const slots: FreeSlot[] = [];

  for (let i = 0; i < days; i++) {
    const dateKey = addDays(startParts.dateKey, i);
    const weekday = weekdayOf(dateKey);

    let windowStart = availability.dayStartMin;
    const windowEnd = availability.dayEndMin;

    // Today is already partly gone.
    if (i === 0) windowStart = Math.max(windowStart, roundUpTo(startParts.minutesOfDay));
    if (windowStart >= windowEnd) continue;

    for (const iv of subtract(windowStart, windowEnd, busyForDay(availability.busy, weekday))) {
      const minutes = iv.end - iv.start;
      if (minutes < minSlotMinutes) continue;

      slots.push({
        dateKey,
        start: zonedInstant(dateKey, iv.start, tz),
        end: zonedInstant(dateKey, iv.end, tz),
        minutes,
      });
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}

/** Total open minutes per day — the input to the daily cap and the 20% buffer. */
export function freeMinutesByDay(slots: FreeSlot[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of slots) out.set(s.dateKey, (out.get(s.dateKey) ?? 0) + s.minutes);
  return out;
}

/** A sensible starting availability: classes unknown, sleep declared, nothing else. */
export function defaultAvailability(): Availability {
  const busy: BusyBlock[] = [];
  for (let day = 0; day < 7; day++) {
    busy.push({
      id: `sleep-${day}`,
      day,
      startMin: 23 * 60,
      endMin: 7 * 60,     // wraps past midnight; handled by busyForDay
      label: 'Sleep',
      kind: 'sleep',
    });
  }

  return {
    busy,
    dayStartMin: 8 * 60,
    dayEndMin: 22 * 60,
    energy: 'steady',
    maxDailyMinutes: 300,
  };
}
