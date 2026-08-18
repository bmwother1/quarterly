/**
 * Timezone arithmetic.
 *
 * The scheduler thinks in local wall-clock terms ("Tuesday 2pm", "45 minutes
 * after class") but stores instants. Every conversion between the two lives
 * here so there is exactly one place to be wrong.
 */

export const DEFAULT_TZ = 'America/Los_Angeles';

export interface LocalParts {
  year: number;
  month: number;   // 1–12
  day: number;     // 1–31
  hour: number;    // 0–23
  minute: number;
  /** 0 = Monday … 6 = Sunday. Monday-anchored because that's how a school week reads. */
  weekday: number;
  /** YYYY-MM-DD in the target zone. */
  dateKey: string;
  /** Minutes after local midnight. */
  minutesOfDay: number;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function localParts(d: Date, tz = DEFAULT_TZ): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  });

  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;

  const year = +p.year;
  const month = +p.month;
  const day = +p.day;
  // Intl renders midnight as "24" under hour12:false in some engines.
  const hour = +p.hour % 24;
  const minute = +p.minute;

  return {
    year, month, day, hour, minute,
    weekday: WEEKDAYS.indexOf(p.weekday),
    dateKey: `${p.year}-${p.month}-${p.day}`,
    minutesOfDay: hour * 60 + minute,
  };
}

/**
 * What wall clock does this instant read as in `zone`, expressed as a UTC-based
 * epoch so it can be compared directly against a desired wall clock.
 */
export function wallClockIn(epoch: number, zone: string): number {
  const p = localParts(new Date(epoch), zone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
}

/**
 * The instant at which the clock in `tz` reads the given local date and
 * minutes-after-midnight.
 *
 * Measure how far off the current guess reads, shift by exactly that, and
 * re-measure. The second pass only matters near a DST boundary, where the first
 * shift can land in an offset different from the one it was computed against.
 */
export function zonedInstant(dateKey: string, minutesOfDay: number, tz = DEFAULT_TZ): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const target = Date.UTC(y, m - 1, d + Math.floor(hour / 24), hour % 24, minute, 0);

  let guess = target;
  for (let i = 0; i < 2; i++) {
    const drift = target - wallClockIn(guess, tz);
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess);
}

/** Advance a YYYY-MM-DD key by n calendar days. */
export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday, for a YYYY-MM-DD key. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** The Monday of the week containing this instant, as YYYY-MM-DD in `tz`. */
export function mondayOf(d: Date, tz = DEFAULT_TZ): string {
  const p = localParts(d, tz);
  return addDays(p.dateKey, -p.weekday);
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  const x = typeof a === 'string' ? new Date(a) : a;
  const y = typeof b === 'string' ? new Date(b) : b;
  return (y.getTime() - x.getTime()) / 60000;
}

export function fmtTime(d: Date | string, tz = DEFAULT_TZ): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}

export function fmtDay(d: Date | string, tz = DEFAULT_TZ): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' });
}
