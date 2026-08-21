/**
 * Expanding repeating events.
 *
 * A Canvas feed is almost entirely one-off deadlines, so the original parser
 * ignored RRULE and lost nothing. A personal calendar is the opposite: a
 * student's timetable is *all* recurrence, so importing one without this gives
 * you a single Tuesday lecture and nothing else.
 *
 * Deliberately not a full RFC 5545 implementation. It covers what Google, Apple
 * and Outlook actually emit for the repeating things in a student's life —
 * weekly classes, a shift every other Friday — and returns null on anything it
 * doesn't understand rather than guessing.
 */

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

export interface Recurrence {
  freq: 'DAILY' | 'WEEKLY';
  interval: number;
  /** Weekday numbers, 0 = Sunday, matching Date.getUTCDay(). */
  byDay: number[];
  until: Date | null;
  count: number | null;
}

/** Parse an RRULE value, or null when it uses something unsupported. */
export function parseRRule(value: string): Recurrence | null {
  const parts: Record<string, string> = {};
  for (const chunk of value.split(';')) {
    const [k, v] = chunk.split('=');
    if (k && v) parts[k.toUpperCase()] = v;
  }

  const freq = parts.FREQ?.toUpperCase();
  // Monthly and yearly recurrence exists, but almost never for the things that
  // block a student's week, and BYSETPOS is a meaningful amount of code to get
  // right. Skipping is honest; guessing would not be.
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return null;

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1);

  const byDay = (parts.BYDAY ?? '')
    .split(',')
    .map((d) => DAY_CODES.indexOf(d.trim().slice(-2).toUpperCase() as (typeof DAY_CODES)[number]))
    .filter((i) => i >= 0);

  let until: Date | null = null;
  if (parts.UNTIL) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(parts.UNTIL);
    if (m) until = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 23), +(m[5] ?? 59), +(m[6] ?? 59)));
  }

  return { freq, interval, byDay, until, count: parts.COUNT ? Math.max(1, Number(parts.COUNT) || 1) : null };
}

/**
 * Every occurrence of a repeating event inside a window.
 *
 * Bounded twice — by the window and by a hard cap — because a rule with no
 * UNTIL and no COUNT describes an infinite series, and an import must never be
 * able to hang the browser on somebody else's malformed calendar.
 */
export function expand(
  start: Date,
  end: Date,
  rule: Recurrence,
  windowStart: Date,
  windowEnd: Date,
  exceptions: Date[] = [],
  maxOccurrences = 400,
): Array<{ start: Date; end: Date }> {
  const durationMs = Math.max(0, end.getTime() - start.getTime());
  const skip = new Set(exceptions.map((d) => d.getTime()));
  const out: Array<{ start: Date; end: Date }> = [];

  const hardStop = rule.until && rule.until < windowEnd ? rule.until : windowEnd;
  const stepDays = rule.freq === 'DAILY' ? rule.interval : 1;

  let emitted = 0;
  let cursor = new Date(start.getTime());
  let guard = 0;

  while (cursor <= hardStop && emitted < maxOccurrences && guard < 5000) {
    guard += 1;

    const weeksElapsed = Math.floor((cursor.getTime() - start.getTime()) / (7 * 86_400_000));
    const onInterval = rule.freq === 'WEEKLY' ? weeksElapsed % rule.interval === 0 : true;
    const onDay = rule.byDay.length === 0
      ? rule.freq === 'DAILY' || cursor.getUTCDay() === start.getUTCDay()
      : rule.byDay.includes(cursor.getUTCDay());

    if (onInterval && onDay && !skip.has(cursor.getTime())) {
      emitted += 1;
      if (rule.count !== null && emitted > rule.count) break;
      if (cursor >= windowStart) {
        out.push({ start: new Date(cursor.getTime()), end: new Date(cursor.getTime() + durationMs) });
      }
    }

    cursor = new Date(cursor.getTime() + stepDays * 86_400_000);
  }

  return out;
}
