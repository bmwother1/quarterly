import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineFor, deadlinesByDay, statusLabel } from '../src/lib/schedule/deadlines.ts';
import type { Assignment, StudyBlock } from '../src/lib/types.ts';

/**
 * The calendar now shows each deadline beside its sessions. The status on that
 * marker is the thing a student reads at a glance, so the plausible mistakes are
 * the ones that make it say "fine" when it is not.
 */

const TZ = 'America/Los_Angeles';
const now = new Date('2026-10-12T16:00:00.000Z');

function assignment(over: Partial<Assignment> = {}): Assignment {
  return {
    id: 'a1', title: 'Problem Set 5', course: 'CHEM 142', courseFull: 'CHEM 142 A', kind: 'problem set',
    due: '2026-10-15T06:59:00.000Z', allDay: false, url: null, estimatedMinutes: 120, actualMinutes: 0,
    status: 'todo', weight: 0.03, confidence: 0.5, lastTouched: null, ...over,
  };
}
function block(start: string, over: Partial<StudyBlock> = {}): StudyBlock {
  const end = new Date(Date.parse(start) + 3_600_000).toISOString();
  return {
    id: `b-${start}`, assignmentId: 'a1', commitmentId: null, course: 'CHEM 142', title: 'Problem Set 5',
    start, end, minutes: 60, method: 'practice problems', why: '', sessionIndex: 1, sessionCount: 2,
    status: 'planned', actualMinutes: null, ...over,
  };
}

describe('a deadline next to its sessions', () => {
  test('nothing planned before it is the loud case', () => {
    const d = deadlineFor(assignment(), [], [], now, TZ);
    assert.equal(d.status, 'unplanned');
    assert.equal(statusLabel(d), 'no time planned');
  });

  test('sessions in the past do not count as planned', () => {
    // A block that already went by without an answer is not time set aside.
    // Counting it would show "1 session planned" for work nobody is doing.
    const d = deadlineFor(assignment(), [block('2026-10-11T17:00:00.000Z')], [], now, TZ);
    assert.equal(d.status, 'unplanned');
    assert.equal(d.planned, 0);
  });

  test('future sessions make it planned, and the last one is reported', () => {
    const d = deadlineFor(assignment(), [
      block('2026-10-13T17:00:00.000Z'),
      block('2026-10-14T17:00:00.000Z'),
    ], [], now, TZ);
    assert.equal(d.status, 'planned');
    assert.equal(d.planned, 2);
    assert.equal(d.lastSessionEnd, '2026-10-14T18:00:00.000Z');
  });

  test("didn't fit wins over a partial plan", () => {
    // Two sessions planned out of four needed must not read as fine.
    const d = deadlineFor(assignment(), [block('2026-10-13T17:00:00.000Z')],
      [{ assignmentId: 'a1', commitmentId: null, title: 'x', course: 'CHEM 142', minutes: 60, reason: 'no room left this week' }],
      now, TZ);
    assert.equal(d.status, 'short');
  });

  test('done and past due are told apart', () => {
    assert.equal(deadlineFor(assignment({ status: 'done' }), [], [], now, TZ).status, 'done');
    assert.equal(deadlineFor(assignment({ due: '2026-10-11T06:59:00.000Z' }), [], [], now, TZ).status, 'past');
  });

  test('an all-day deadline is due at the end of its day, on that day', () => {
    // Canvas all-day items are stored at local noon. Filing them under the
    // wrong date, or at noon, is how a deadline appears a day early.
    const a = assignment({ allDay: true, due: '2026-10-14T19:00:00.000Z' });
    const map = deadlinesByDay([a], [], [], ['2026-10-14', '2026-10-15'], now, TZ);
    assert.equal(map.get('2026-10-14')?.length, 1);
    assert.equal(map.has('2026-10-15'), false);
  });

  test("an 11:59pm deadline is filed under its own local day, not UTC's", () => {
    // 2026-10-15T06:59Z is 11:59pm on the 14th in Seattle.
    const map = deadlinesByDay([assignment()], [], [], ['2026-10-14', '2026-10-15'], now, TZ);
    assert.equal(map.get('2026-10-14')?.[0].id, 'a1');
  });

  test('dropped work does not appear at all', () => {
    const map = deadlinesByDay([assignment({ status: 'dropped' })], [], [], ['2026-10-14'], now, TZ);
    assert.equal(map.size, 0);
  });
});
