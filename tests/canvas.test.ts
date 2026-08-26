import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toDate, parseICS, looksLikeCalendar } from '../src/lib/canvas/ics.ts';
import {
  classifyWork,
  assignmentsFromICS,
  coursesFrom,
  normaliseCourse,
  reviseEstimate,
  workloadByWeek,
  mondayOf,
} from '../src/lib/canvas/interpret.ts';

const midquarter = readFileSync(new URL('../fixtures/sample-feed-midquarter.ics', import.meta.url), 'utf8');
const fullQuarter = readFileSync(new URL('../fixtures/sample-feed.ics', import.meta.url), 'utf8');

describe('ICS timestamps', () => {
  test('UTC timestamps are taken literally', () => {
    const r = toDate('20261013T065900Z', {});
    assert.equal(r!.date.toISOString(), '2026-10-13T06:59:00.000Z');
    assert.equal(r!.allDay, false);
  });

  test('date-only values are all-day, anchored mid-day', () => {
    const r = toDate('20261012', {});
    assert.equal(r!.allDay, true);
    // Noon UTC keeps the date stable when read back in any US zone.
    assert.equal(r!.date.toISOString(), '2026-10-12T12:00:00.000Z');
  });

  test('floating time resolves against the given zone, not the machine zone', () => {
    // 11:59pm Pacific on Oct 12 (PDT, UTC-7) is 06:59 UTC on Oct 13.
    const r = toDate('20261012T235900', { TZID: 'America/Los_Angeles' });
    assert.equal(r!.date.toISOString(), '2026-10-13T06:59:00.000Z');
  });

  test('survives the DST boundary', () => {
    // US DST ends Nov 1 2026. Nov 5 is PST (UTC-8), so 11:59pm → 07:59 UTC.
    const after = toDate('20261105T235900', { TZID: 'America/Los_Angeles' });
    assert.equal(after!.date.toISOString(), '2026-11-06T07:59:00.000Z');

    // Oct 29 is still PDT (UTC-7) → 06:59 UTC. Same wall clock, different offset.
    const before = toDate('20261029T235900', { TZID: 'America/Los_Angeles' });
    assert.equal(before!.date.toISOString(), '2026-10-30T06:59:00.000Z');
  });

  test('an eastern-zone deadline is not silently treated as Pacific', () => {
    const r = toDate('20261012T235900', { TZID: 'America/New_York' });
    assert.equal(r!.date.toISOString(), '2026-10-13T03:59:00.000Z');
  });
});

describe('ICS structure', () => {
  test('recognises a calendar file', () => {
    assert.equal(looksLikeCalendar(midquarter), true);
    assert.equal(looksLikeCalendar('<!doctype html><html>Canvas login page</html>'), false);
  });

  test('parses every VEVENT in the fixture', () => {
    const events = parseICS(midquarter);
    assert.equal(events.length, 70);
    assert.ok(events.every((e) => e.summary));
  });

  test('unfolds wrapped lines', () => {
    const raw = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:event-assignment-1',
      'SUMMARY:A very long assignment title that Canvas wrapped acr',
      ' oss two lines [CHEM 142 A]',
      'DTSTART:20261012T235900Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [ev] = parseICS(raw);
    assert.equal(ev.summary, 'A very long assignment title that Canvas wrapped across two lines [CHEM 142 A]');
  });
});

describe('work classification', () => {
  test('specific words beat generic ones', () => {
    // The bug this test exists to prevent: "Final" anywhere makes it an exam.
    assert.equal(classifyWork('Major Paper 2 Final'), 'writing');
    assert.equal(classifyWork('Final Project Presentation'), 'project');
    assert.equal(classifyWork('Final Exam'), 'exam');
    assert.equal(classifyWork('Final'), 'exam');
  });

  test('covers the common Canvas vocabulary', () => {
    assert.equal(classifyWork('Problem Set 4'), 'problem set');
    assert.equal(classifyWork('WebAssign 2'), 'problem set');
    assert.equal(classifyWork('Quiz 3'), 'quiz');
    assert.equal(classifyWork('Midterm 1'), 'exam');
    assert.equal(classifyWork('Lab 5: Titration'), 'lab');
    assert.equal(classifyWork('Discussion Post 3'), 'discussion');
    assert.equal(classifyWork('Reading Response 3'), 'reading');
    assert.equal(classifyWork('Programming Assignment 2'), 'project');
    assert.equal(classifyWork('Something unlabelled'), 'other');
  });
});

describe('assignments from a real feed', () => {
  const assignments = assignmentsFromICS(midquarter);

  test('keeps assignments and drops other calendar items', () => {
    assert.equal(assignments.length, 65);
    assert.equal(assignmentsFromICS(midquarter, { includeNonAssignments: true }).length, 70);
  });

  test('splits title from course', () => {
    const a = assignments.find((x) => x.title === 'Problem Set 2');
    assert.ok(a, 'expected Problem Set 2 in the fixture');
    assert.equal(a!.course, 'CHEM 142');
    assert.equal(a!.kind, 'problem set');
  });

  test('is sorted by due date', () => {
    for (let i = 1; i < assignments.length; i++) {
      assert.ok(assignments[i - 1].due <= assignments[i].due);
    }
  });

  test('gives every assignment a positive duration and weight', () => {
    assert.ok(assignments.every((a) => a.estimatedMinutes > 0));
    assert.ok(assignments.every((a) => a.weight > 0 && a.weight <= 0.4));
  });

  test('finals are estimated larger than their mid-quarter equivalents', () => {
    const midterm = assignments.find((a) => /midterm/i.test(a.title));
    const final = assignments.find((a) => /final exam/i.test(a.title));
    if (midterm && final) assert.ok(final.estimatedMinutes > midterm.estimatedMinutes);
  });

  test('extracts four courses with distinct colours', () => {
    const courses = coursesFrom(assignments);
    assert.equal(courses.length, 4);
    assert.equal(new Set(courses.map((c) => c.shade)).size, 4);
    assert.deepEqual(courses.map((c) => c.code).sort(), ['CHEM 142', 'CSE 121', 'ENGL 131', 'MATH 124']);
  });

  test('strips section suffixes', () => {
    assert.equal(normaliseCourse('CHEM 142 AA'), 'CHEM 142');
    assert.equal(normaliseCourse('CHEM 142 A'), 'CHEM 142');
    assert.equal(normaliseCourse('CHEM 142'), 'CHEM 142');
  });

  test('the full-quarter feed parses too', () => {
    const all = assignmentsFromICS(fullQuarter);
    assert.ok(all.length > 0);
    assert.ok(coursesFrom(all).length >= 1);
  });
});

describe('estimate revision', () => {
  test('with no data, the seed stands', () => {
    assert.equal(reviseEstimate(120, []), 120);
  });

  test('one observation moves the estimate but does not replace it', () => {
    const revised = reviseEstimate(120, [240]);
    assert.ok(revised > 120 && revised < 240, `expected between 120 and 240, got ${revised}`);
  });

  test('repeated observations converge toward reality', () => {
    const one = reviseEstimate(120, [240]);
    const many = reviseEstimate(120, [240, 230, 250]);
    assert.ok(many > one, 'more evidence should pull harder');
    assert.ok(many < 240);
  });
});

describe('workload by week', () => {
  const weeks = workloadByWeek(assignmentsFromICS(midquarter));

  test('buckets are Mondays, in order', () => {
    for (const w of weeks) {
      assert.match(w.weekStart, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(new Date(w.weekStart + 'T12:00:00Z').getUTCDay(), 1, `${w.weekStart} should be a Monday`);
    }
    for (let i = 1; i < weeks.length; i++) {
      assert.ok(weeks[i - 1].weekStart < weeks[i].weekStart);
    }
  });

  test('every assignment lands in exactly one bucket', () => {
    const total = weeks.reduce((s, w) => s + w.count, 0);
    assert.equal(total, 65);
  });

  test('exam weeks are flagged', () => {
    assert.ok(weeks.some((w) => w.hasExam));
  });

  test('a Sunday deadline belongs to the week that started the Monday before', () => {
    // Sun Oct 11 2026 → week of Mon Oct 5.
    assert.equal(mondayOf(new Date('2026-10-11T20:00:00Z')), '2026-10-05');
    assert.equal(mondayOf(new Date('2026-10-12T20:00:00Z')), '2026-10-12');
  });
});
