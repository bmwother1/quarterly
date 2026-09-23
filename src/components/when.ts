import type { StudyBlock } from '@/lib/types';
import { addDays, fmtTime, localParts } from '@/lib/time';

/**
 * How the interface talks about time relative to now. Shared by the week and
 * the day so "Next · 3:00 PM, in 1h 20m" reads the same on both.
 */

/** "in 20 min", "in 1h 20m". */
export function until(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `in ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `in ${h}h ${r}m` : `in ${h}h`;
}

/** "Today", "Tomorrow", or the weekday. */
export function dayName(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Today';
  if (dateKey === addDays(todayKey, 1)) return 'Tomorrow';
  return new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
}

/** "Sep 23". */
export function shortDate(dateKey: string): string {
  return new Date(dateKey + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
}

/**
 * What to call the block a screen is about.
 *
 * Three cases, because "next" means three things: a block whose time passed
 * without an answer is the first thing to deal with, one under way is
 * happening now, and anything else is coming up. `openPast` is decided by the
 * caller against its fixed clock; `now` is the live one, for the countdown.
 */
export function focusLabel(
  block: StudyBlock, openPast: boolean, now: Date, todayKey: string, tz: string,
): { lead: string; rest: string } {
  const start = new Date(block.start);
  const end = new Date(block.end);
  if (openPast) return { lead: 'Still open', rest: `${fmtTime(start, tz)} to ${fmtTime(end, tz)}` };
  if (start <= now && now < end) return { lead: 'Now', rest: `until ${fmtTime(end, tz)}` };
  const key = localParts(start, tz).dateKey;
  if (key === todayKey) return { lead: 'Next', rest: `${fmtTime(start, tz)}, ${until(start.getTime() - now.getTime())}` };
  const day = dayName(key, todayKey);
  return { lead: 'Next', rest: `${day === 'Tomorrow' ? 'tomorrow' : day} at ${fmtTime(start, tz)}` };
}
