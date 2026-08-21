import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseRRule, expand } from '../src/lib/calendar/recurrence.ts';
import { eventsFromICS } from '../src/lib/calendar/import.ts';
import { identifySource } from '../src/lib/calendar/sources.ts';
import { validateFeedUrl } from '../src/lib/canvas/feed-url.ts';
import { zonedInstant, localParts } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';

/** A student timetable as Google actually emits one. */
const TIMETABLE = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar//EN',
  // MWF lecture, all quarter.
  'BEGIN:VEVENT', 'UID:lecture@google', 'SUMMARY:CHEM 142 Lecture', 'LOCATION:Bagley 154',
  'DTSTART;TZID=America/Los_Angeles:20261005T093000',
  'DTEND;TZID=America/Los_Angeles:20261005T102000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261211T235959Z', 'END:VEVENT',
  // Fortnightly shift.
  'BEGIN:VEVENT', 'UID:shift@google', 'SUMMARY:Work shift',
  'DTSTART;TZID=America/Los_Angeles:20261009T100000',
  'DTEND;TZID=America/Los_Angeles:20261009T160000',
  'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR', 'END:VEVENT',
  // One-off.
  'BEGIN:VEVENT', 'UID:dentist@google', 'SUMMARY:Dentist',
  'DTSTART;TZID=America/Los_Angeles:20261007T140000',
  'DTEND;TZID=America/Los_Angeles:20261007T150000', 'END:VEVENT',
  // All-day. Must be ignored: blacking out every hour of spring break is the
  // opposite of useful.
  'BEGIN:VEVENT', 'UID:break@google', 'SUMMARY:Spring Break',
  'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261013', 'END:VEVENT',
  // Monthly — deliberately unsupported, must be counted not guessed.
  'BEGIN:VEVENT', 'UID:monthly@google', 'SUMMARY:Club meeting',
  'DTSTART;TZID=America/Los_Angeles:20261006T180000',
  'DTEND;TZID=America/Los_Angeles:20261006T190000',
  'RRULE:FREQ=MONTHLY;BYDAY=1TU', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const MONDAY = zonedInstant('2026-10-05', 0, TZ);

describe('recurrence rules', () => {
  test('reads the shapes calendars actually emit', () => {
    const weekly = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20261211T235959Z')!;
    assert.equal(weekly.freq, 'WEEKLY');
    assert.deepEqual(weekly.byDay, [1, 3, 5]);
    assert.ok(weekly.until instanceof Date);

    const fortnightly = parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')!;
    assert.equal(fortnightly.interval, 2);

    assert.equal(parseRRule('FREQ=DAILY;COUNT=5')!.count, 5);
  });

  test('refuses what it cannot do rather than guessing', () => {
    // Silently treating a monthly rule as weekly would put four times as much
    // in a student's calendar as really exists.
    assert.equal(parseRRule('FREQ=MONTHLY;BYDAY=1TU'), null);
    assert.equal(parseRRule('FREQ=YEARLY'), null);
    assert.equal(parseRRule('nonsense'), null);
  });

  test('an endless rule cannot hang the browser', () => {
    // No UNTIL and no COUNT is an infinite series. The window and the cap are
    // both hard stops.
    const rule = parseRRule('FREQ=DAILY')!;
    const occ = expand(
      new Date('2026-01-01T10:00:00Z'), new Date('2026-01-01T11:00:00Z'), rule,
      new Date('2026-01-01T00:00:00Z'), new Date('2030-01-01T00:00:00Z'),
    );
    assert.ok(occ.length <= 400, `expanded to ${occ.length}`);
  });

  test('cancelled occurrences are left out', () => {
    const rule = parseRRule('FREQ=WEEKLY;BYDAY=MO;COUNT=4')!;
    const start = new Date('2026-10-05T17:00:00Z');
    const skipped = new Date('2026-10-12T17:00:00Z');
    const occ = expand(start, new Date('2026-10-05T18:00:00Z'), rule,
      start, new Date('2026-11-30T00:00:00Z'), [skipped]);
    assert.ok(!occ.some((o) => o.start.getTime() === skipped.getTime()));
  });
});

describe('importing a personal calendar', () => {
  const result = eventsFromICS(TIMETABLE, { tz: TZ, from: MONDAY, days: 14 });

  test('a weekly class becomes every occurrence, not one Tuesday', () => {
    // The bug this whole module exists to prevent: without expansion a
    // timetable imports as a single lecture and the scheduler books over the
    // rest of the term.
    const lectures = result.events.filter((e) => e.title === 'CHEM 142 Lecture');
    assert.ok(lectures.length >= 5, `expected a fortnight of MWF lectures, got ${lectures.length}`);

    const weekdays = new Set(lectures.map((e) => localParts(new Date(e.start), TZ).weekday));
    assert.deepEqual([...weekdays].sort(), [0, 2, 4], 'Monday, Wednesday, Friday');
  });

  test('the local time holds across every occurrence', () => {
    for (const e of result.events.filter((x) => x.title === 'CHEM 142 Lecture')) {
      assert.equal(localParts(new Date(e.start), TZ).minutesOfDay, 9 * 60 + 30);
    }
  });

  test('an every-other-week shift does not become weekly', () => {
    const shifts = result.events.filter((e) => e.title === 'Work shift');
    assert.ok(shifts.length <= 2, `fortnightly over 14 days should be at most 2, got ${shifts.length}`);
  });

  test('one-off events come through with their location', () => {
    const dentist = result.events.find((e) => e.title === 'Dentist');
    assert.ok(dentist);
    const lecture = result.events.find((e) => e.title === 'CHEM 142 Lecture');
    assert.equal(lecture!.note, 'Bagley 154');
  });

  test('all-day entries are ignored', () => {
    // "Spring Break" spans a day and would black out every hour of it — the
    // opposite of the truth, since a student on break has more time, not none.
    assert.equal(result.events.some((e) => e.title === 'Spring Break'), false);
  });

  test('unsupported recurrence is counted, never invented', () => {
    assert.equal(result.skippedRecurring, 1);
    assert.equal(result.events.some((e) => e.title === 'Club meeting'), false);
  });

  test('nothing lands outside the requested window', () => {
    const end = new Date(MONDAY.getTime() + 14 * 86_400_000);
    for (const e of result.events) {
      assert.ok(new Date(e.start) <= end, `${e.title} is past the window`);
    }
  });
});

describe('which calendars are accepted', () => {
  test('the four providers a student actually uses', () => {
    assert.equal(identifySource('canvas.uw.edu')?.produces, 'assignments');
    assert.equal(identifySource('uw.instructure.com')?.produces, 'assignments');
    assert.equal(identifySource('calendar.google.com')?.produces, 'events');
    assert.equal(identifySource('p28-calendars.icloud.com')?.produces, 'events');
    assert.equal(identifySource('outlook.office365.com')?.produces, 'events');
  });

  test('the lookalike-domain hole stays shut for every provider', () => {
    // The original bug was Canvas-specific. Widening the allowlist would have
    // reintroduced it four more times without suffix matching.
    for (const bad of [
      'canvas.uw.edu.attacker.com',
      'calendar.google.com.attacker.com',
      'icloud.com.evil.net',
      'outlook.office365.com.phish.io',
      'notgoogle.com',
    ]) {
      assert.equal(identifySource(bad), null, `${bad} should be refused`);
      assert.equal(validateFeedUrl(`https://${bad}/x.ics`).ok, false);
    }
  });

  test('private space is still refused even wearing a provider name', () => {
    assert.equal(validateFeedUrl('https://calendar.google.com.169.254.169.254/x.ics').ok, false);
    assert.equal(validateFeedUrl('https://localhost/x.ics').ok, false);
  });

  test('real links from each provider are accepted', () => {
    for (const good of [
      'https://canvas.uw.edu/feeds/calendars/user_abc.ics',
      'https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-xyz/basic.ics',
      'https://p28-calendars.icloud.com/published/2/ABCdef',
      'https://outlook.office365.com/owa/calendar/abc/reachcalendar.ics',
    ]) {
      assert.equal(validateFeedUrl(good).ok, true, `${good} should be accepted`);
    }
  });
});
