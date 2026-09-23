import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveZone } from '../src/lib/calendar/timezones.ts';
import { parseICS } from '../src/lib/canvas/ics.ts';
import { eventsFromICS } from '../src/lib/calendar/import.ts';

/**
 * Outlook writes Windows time zone names, and every published Outlook calendar
 * failed to import until this existed. The shapes below are copied from real
 * feeds: Marquette's and Northwestern's, both Exchange Online.
 */

const outlook = (tzid: string, start: string) => [
  'BEGIN:VCALENDAR',
  'PRODID:Microsoft Exchange Server 2010',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:040000008200E00074C5B7101A82E0080000000',
  'SUMMARY:Shift',
  `DTSTART;TZID=${tzid}:${start}`,
  `DTEND;TZID=${tzid}:${start.slice(0, 9)}${String(Number(start.slice(9, 11)) + 1).padStart(2, '0')}0000`,
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('time zones as calendars actually write them', () => {
  test('Windows names map to the zone they mean', () => {
    assert.equal(resolveZone('Pacific Standard Time', 'UTC'), 'America/Los_Angeles');
    assert.equal(resolveZone('Central Standard Time', 'UTC'), 'America/Chicago');
    assert.equal(resolveZone('Eastern Standard Time', 'UTC'), 'America/New_York');
  });

  test('IANA names pass straight through', () => {
    assert.equal(resolveZone('America/Los_Angeles', 'UTC'), 'America/Los_Angeles');
    assert.equal(resolveZone('Europe/London', 'UTC'), 'Europe/London');
  });

  test("Outlook's display form and path-wrapped names are understood", () => {
    assert.equal(resolveZone('(UTC-08:00) Pacific Time (US & Canada)', 'UTC'), 'America/Los_Angeles');
    assert.equal(resolveZone('/mozilla.org/20070129_1/America/New_York', 'UTC'), 'America/New_York');
  });

  test('anything unknown falls back to the student zone instead of throwing', () => {
    assert.equal(resolveZone('Customized Time Zone', 'America/Los_Angeles'), 'America/Los_Angeles');
    assert.equal(resolveZone('', 'America/Los_Angeles'), 'America/Los_Angeles');
  });

  test('an Outlook shift at 5pm Central is 5pm in Chicago, summer and winter', () => {
    // October is daylight time (UTC-5), December standard (UTC-6). Getting the
    // mapping right but the offset wrong would move every shift by an hour.
    const oct = parseICS(outlook('Central Standard Time', '20261015T170000'))[0].start!.date;
    const dec = parseICS(outlook('Central Standard Time', '20261215T170000'))[0].start!.date;
    assert.equal(oct.toISOString(), '2026-10-15T22:00:00.000Z');
    assert.equal(dec.toISOString(), '2026-12-15T23:00:00.000Z');
  });

  test('a whole Outlook calendar imports instead of failing', () => {
    const { events } = eventsFromICS(outlook('Pacific Standard Time', '20261015T090000'), {
      tz: 'America/Los_Angeles', from: new Date('2026-10-01T00:00:00Z'), days: 60,
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].start, '2026-10-15T16:00:00.000Z');
  });

  test('a work app source forces every event to work, whatever it is called', () => {
    const { events } = eventsFromICS(outlook('Pacific Standard Time', '20261015T090000'), {
      tz: 'America/Los_Angeles', from: new Date('2026-10-01T00:00:00Z'), days: 60, category: 'work',
    });
    assert.equal(events[0].category, 'work');
  });
});
