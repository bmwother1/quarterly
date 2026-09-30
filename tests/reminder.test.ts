import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Assignment } from '../src/lib/types.ts';
import { assignmentsFromICS, classifyWork, estimateMinutes } from '../src/lib/canvas/interpret.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { deadlinesByDay } from '../src/lib/schedule/deadlines.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { nextNotice } from '../src/lib/notify.ts';
import { zonedInstant } from '../src/lib/time.ts';

/**
 * Canvas reminders are not work. Found on Brydon's first real import: "Final
 * Reminder to Complete Peer Feedback" read as an exam, got eight sessions, and
 * topped the week as "worth about 40% of your MGMT 305 grade".
 */

const TZ = 'America/Los_Angeles';
const TITLE = "Final Reminder to Complete Peer Feedback [Can't Be Extended]";
const MONDAY = zonedInstant('2026-10-05', 8 * 60, TZ);
const DUE = zonedInstant('2026-10-08', 23 * 60 + 59, TZ).toISOString();

function item(over: Partial<Assignment> = {}): Assignment {
  return {
    id: 'r1', title: TITLE, course: 'MGMT 305', courseFull: 'MGMT 305 A', kind: 'other', due: DUE,
    allDay: false, url: null, estimatedMinutes: 0, actualMinutes: 0, status: 'todo', weight: 0.01,
    confidence: 0.5, lastTouched: null, ...over,
  };
}

describe('Canvas reminders', () => {
  test('"Final Reminder" is not an exam and needs no time', () => {
    assert.equal(classifyWork(TITLE), 'other');
    assert.equal(estimateMinutes('other', TITLE), 0);
    assert.equal(classifyWork('Final Exam'), 'exam');
  });

  test('imported from a feed, it arrives with no study time', () => {
    const ics = [
      'BEGIN:VCALENDAR', 'PRODID:-//Instructure//Canvas//EN',
      'BEGIN:VEVENT', 'UID:event-assignment-1', 'DTSTART:20261009T065900Z', `SUMMARY:${TITLE} [MGMT 305 A]`, 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [a] = assignmentsFromICS(ics);
    assert.equal(a.kind, 'other');
    assert.equal(a.estimatedMinutes, 0);
  });

  test('a week imported before this rule loses the sessions on replan', () => {
    // The shape Brydon's week actually holds: classified as an exam, 450 minutes.
    const legacy = item({ kind: 'exam', estimatedMinutes: 450, weight: 0.4 });
    const plan = planWeek([legacy], defaultAvailability(), { now: MONDAY, tz: TZ });
    assert.equal(plan.blocks.length, 0);
    assert.equal(plan.unscheduled.length, 0, 'and it is not reported as work that did not fit');
  });

  test('no deadline flag', () => {
    const map = deadlinesByDay([item()], [], [], ['2026-10-08'], MONDAY, TZ);
    assert.equal(map.get('2026-10-08')?.length ?? 0, 0);
  });
});

describe('the reminder notification', () => {
  const base = { blocks: [], commitments: [], tz: TZ };
  const at = (day: string, min: number) => zonedInstant(day, min, TZ);

  test('sent once, at 9am on the day it is due', () => {
    const assignments = [item()];
    const before = nextNotice({ ...base, assignments, now: at('2026-10-08', 8 * 60 + 59), lastSentAt: null });
    const during = nextNotice({ ...base, assignments, now: at('2026-10-08', 9 * 60 + 4), lastSentAt: null });
    const after = nextNotice({ ...base, assignments, now: at('2026-10-08', 9 * 60 + 10), lastSentAt: null });
    assert.equal(before, null);
    assert.equal(during?.kind, 'reminder');
    assert.match(during!.body, /Due today at 11:59/);
    assert.equal(after, null, 'the next ten-minute run must not send it again');
  });

  test('due before 9am, it comes the evening before', () => {
    const early = item({ due: zonedInstant('2026-10-08', 8 * 60, TZ).toISOString() });
    const n = nextNotice({ ...base, assignments: [early], now: at('2026-10-07', 20 * 60 + 1), lastSentAt: null });
    assert.equal(n?.kind, 'reminder');
    assert.match(n!.body, /Due tomorrow/);
  });

  test('not held back by something already sent today', () => {
    const n = nextNotice({
      ...base, assignments: [item()], now: at('2026-10-08', 9 * 60 + 1),
      lastSentAt: at('2026-10-08', 7 * 60).toISOString(),
    });
    assert.equal(n?.kind, 'reminder');
  });

  test('ordinary work never becomes a reminder', () => {
    const hw = item({ title: 'Homework 3', kind: 'problem set', estimatedMinutes: 120 });
    assert.equal(nextNotice({ ...base, assignments: [hw], now: at('2026-10-08', 9 * 60 + 1), lastSentAt: null }), null);
  });
});
