/**
 * Turning any calendar feed into things Heron understands.
 *
 * Two destinations, decided by where the feed came from:
 *
 *   Canvas → assignments. Work with a deadline that the scheduler places.
 *   Anything else → fixed events. Time already spoken for that it plans around.
 *
 * That split is the whole reason importing a personal calendar is useful. A
 * lecture at 10am on Tuesdays isn't a task to be scheduled; it's a reason the
 * scheduler must stop putting things at 10am on Tuesdays.
 */

import { categoryForImportedEvent, nextShade } from '../categories.ts';
import type { FixedEvent } from '../types.ts';
import { parseICS } from '../canvas/ics.ts';
import { parseRRule, expand } from './recurrence.ts';

export interface ImportedEvents {
  events: FixedEvent[];
  /** Series that repeat in a way this parser doesn't handle, e.g. monthly. */
  skippedRecurring: number;
}

/**
 * Fixed events from a personal calendar, expanded across a window.
 *
 * All-day entries are dropped rather than imported. "Spring Break" or a
 * birthday spans a whole day and would black out every hour of it, which is the
 * opposite of useful — a student on spring break has *more* free time, not
 * none.
 */
export function eventsFromICS(
  raw: string,
  opts: { tz: string; from: Date; days: number; produces?: 'assignments' | 'events' },
): ImportedEvents {
  const parsed = parseICS(raw, opts.tz);
  const windowStart = opts.from;
  const windowEnd = new Date(opts.from.getTime() + opts.days * 86_400_000);

  const events: FixedEvent[] = [];
  let skippedRecurring = 0;
  /**
   * Shade per distinct series, not per occurrence.
   *
   * A weekly lecture expands into twenty events and they are one thing, so they
   * share a shade. Incrementing per occurrence would have burned the whole
   * ladder on a single course and made every calendar look identical.
   */
  const shadeBySeries = new Map<string, number>();

  for (const ev of parsed) {
    if (!ev.start || ev.start.allDay) continue;

    const title = (ev.summary ?? 'Busy').trim();
    const start = ev.start.date;
    // A calendar entry with no end is a marker, not a commitment. An hour is
    // the least-wrong assumption and matches what most clients show.
    const end = ev.end?.date ?? new Date(start.getTime() + 60 * 60_000);

    // Guessed from the title, because a feed gives nothing better. Wrong
    // guesses are cheap here: the student can change it, and the default is
    // the broad one rather than a confident mistake.
    const category = categoryForImportedEvent(opts.produces ?? 'events', title);
    const seriesKey = `${category}:${ev.uid ?? title}`;
    if (!shadeBySeries.has(seriesKey)) {
      const taken = [...shadeBySeries.entries()]
        .filter(([k]) => k.startsWith(`${category}:`))
        .map(([, v]) => v);
      shadeBySeries.set(seriesKey, nextShade(category, taken));
    }
    const shade = shadeBySeries.get(seriesKey)!;

    if (ev.rrule) {
      const rule = parseRRule(ev.rrule);
      if (!rule) { skippedRecurring += 1; continue; }

      for (const occ of expand(start, end, rule, windowStart, windowEnd, ev.exceptions ?? [])) {
        events.push({
          id: `imp-${ev.uid ?? title}-${occ.start.getTime()}`,
          title,
          start: occ.start.toISOString(),
          end: occ.end.toISOString(),
          note: ev.location ?? null,
          category,
          shade,
        });
      }
      continue;
    }

    if (start > windowEnd || end < windowStart) continue;

    events.push({
      id: `imp-${ev.uid ?? `${title}-${start.getTime()}`}`,
      title,
      start: start.toISOString(),
      end: end.toISOString(),
      note: ev.location ?? null,
      category,
      shade,
    });
  }

  // One calendar can legitimately hold hundreds of occurrences. Sorting makes
  // the preview readable and the dedupe below cheap.
  events.sort((a, b) => a.start.localeCompare(b.start));

  const seen = new Set<string>();
  const unique = events.filter((e) => {
    const key = `${e.title}@${e.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { events: unique, skippedRecurring };
}
