/**
 * A small, dependency-free iCalendar parser.
 *
 * We only need VEVENTs and a handful of properties, so a full RFC 5545
 * implementation would be dead weight. What we do have to get exactly right is
 * time: Canvas emits three different timestamp shapes and getting one wrong
 * shifts a deadline by hours in a way nobody notices until they miss it.
 */

import { wallClockIn, DEFAULT_TZ } from '../time.ts';

export { DEFAULT_TZ };

export interface IcsEvent {
  uid?: string;
  summary?: string;
  description?: string;
  url?: string;
  start?: { date: Date; allDay: boolean };
  end?: { date: Date; allDay: boolean };
}

/**
 * Long ICS lines wrap, and continuation lines begin with a space or tab.
 * They have to be glued back together before anything else is parsed.
 */
function unfold(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

interface ParsedLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** "DTSTART;TZID=America/Los_Angeles:20261012T235900" → name / params / value */
function parseLine(line: string): ParsedLine | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(';');
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > -1) {
      params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1).replace(/^"|"$/g, '');
    }
  }
  return { name: parts[0].toUpperCase(), params, value };
}

/**
 * Turn an ICS timestamp into a real instant.
 *
 * Three shapes:
 *   20261012                → all-day (anchored at local noon so day-bucketing
 *                             never slips across a date line)
 *   20261013T065900Z        → UTC, unambiguous
 *   20261012T235900         → wall clock in TZID (or the default zone)
 *
 * The third case is the one with teeth. We want the instant whose local time in
 * that zone reads back as the given wall clock. Measure how far the current
 * guess reads off by, shift by exactly that, and re-measure. The second pass
 * matters only near a DST boundary, where the first shift can land in a zone
 * offset different from the one it was computed against.
 */
export function toDate(value: string, params: Record<string, string>, tz = DEFAULT_TZ) {
  if (/^\d{8}$/.test(value) || params.VALUE === 'DATE') {
    const y = +value.slice(0, 4), m = +value.slice(4, 6), d = +value.slice(6, 8);
    return { date: new Date(Date.UTC(y, m - 1, d, 12)), allDay: true };
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) return null;

  const [, Y, Mo, D, H, Mi, S, z] = m;
  if (z) return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)), allDay: false };

  const zone = params.TZID || tz;
  const target = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const drift = target - wallClockIn(guess, zone);
    if (drift === 0) break;
    guess += drift;
  }
  return { date: new Date(guess), allDay: false };
}

export function parseICS(raw: string, tz = DEFAULT_TZ): IcsEvent[] {
  const lines = unfold(raw).split('\n');
  const events: IcsEvent[] = [];
  let cur: IcsEvent | null = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { cur = {}; continue; }
    if (line.startsWith('END:VEVENT')) { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;

    const p = parseLine(line);
    if (!p) continue;

    if (p.name === 'SUMMARY') cur.summary = unescapeText(p.value);
    else if (p.name === 'DESCRIPTION') cur.description = unescapeText(p.value);
    else if (p.name === 'URL') cur.url = p.value;
    else if (p.name === 'UID') cur.uid = p.value;
    else if (p.name === 'DTSTART') cur.start = toDate(p.value, p.params, tz) ?? undefined;
    else if (p.name === 'DTEND') cur.end = toDate(p.value, p.params, tz) ?? undefined;
  }

  return events;
}

export function looksLikeCalendar(raw: string): boolean {
  return /BEGIN:VCALENDAR/i.test(raw);
}
