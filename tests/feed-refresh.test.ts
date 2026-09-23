import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCanvasImport, describeMerge, applyCanvas } from '../src/lib/canvas/merge.ts';
import { emptyState } from '../src/lib/store.ts';
import type { StudyBlock } from '../src/lib/types.ts';
import { feedPrompt, daysSince, dueForRefresh } from '../src/lib/canvas/freshness.ts';
import type { Assignment, Course } from '../src/lib/types.ts';

/**
 * The failure mode this whole feature exists for is silent: a refresh that runs
 * cleanly and quietly destroys what the student did. So the tests here are
 * almost all about what has to *survive* a refresh, not what arrives in one.
 */

function assignment(over: Partial<Assignment> & { id: string }): Assignment {
  return {
    title: 'Problem Set 1',
    course: 'CHEM 142',
    courseFull: 'CHEM 142 A',
    kind: 'problem set',
    due: '2026-10-05T06:59:00.000Z',
    allDay: false,
    url: null,
    estimatedMinutes: 120,
    actualMinutes: 0,
    status: 'todo',
    weight: 0.03,
    confidence: 0.5,
    lastTouched: null,
    ...over,
  };
}

const courses: Course[] = [{ code: 'CHEM 142', fullName: 'CHEM 142 A', category: 'deadline', shade: 3 }];

describe('merging a fresh Canvas fetch', () => {
  test('a first import into an empty state is just the feed', () => {
    const r = mergeCanvasImport({ assignments: [], courses: [] }, [assignment({ id: 'a1' })]);
    assert.equal(r.assignments.length, 1);
    assert.equal(r.added, 1);
    assert.equal(r.removed, 0);
  });

  test('finished work survives, with its recorded minutes', () => {
    // The expensive bug. A straight replace hands the scheduler back every
    // assignment the student already completed, and the week fills with work
    // they have watched themselves finish.
    const prev = {
      courses,
      assignments: [assignment({
        id: 'a1', status: 'done', actualMinutes: 145, lastTouched: '2026-10-01T00:00:00.000Z',
      })],
    };
    const r = mergeCanvasImport(prev, [assignment({ id: 'a1' })]);

    const kept = r.assignments.find((a) => a.id === 'a1')!;
    assert.equal(kept.status, 'done');
    assert.equal(kept.actualMinutes, 145);
    assert.equal(kept.lastTouched, '2026-10-01T00:00:00.000Z');
  });

  test('a hand-typed task is never touched by a Canvas refresh', () => {
    // /start creates these, and Canvas has never heard of them. Replacing the
    // list wholesale deleted them, which is a student losing something they
    // typed because they pressed a button labelled "update my deadlines".
    const mine = assignment({ id: 't-1759000000000', title: 'Scholarship essay', course: 'Personal' });
    const r = mergeCanvasImport({ courses, assignments: [mine] }, [assignment({ id: 'a1' })]);

    assert.ok(r.assignments.some((a) => a.id === 't-1759000000000'));
    assert.equal(r.removed, 0);
  });

  test('a hand-typed task never invents a course', () => {
    const mine = assignment({ id: 't-1', course: 'Personal', courseFull: 'Personal' });
    const r = mergeCanvasImport({ courses: [], assignments: [mine] }, [assignment({ id: 'a1' })]);
    assert.deepEqual(r.courses.map((c) => c.code), ['CHEM 142']);
  });

  test('Canvas wins on the due date, the student wins on the estimate', () => {
    const prev = {
      courses,
      assignments: [assignment({ id: 'a1', estimatedMinutes: 240, actualMinutes: 90, lastTouched: '2026-10-01T00:00:00.000Z' })],
    };
    const r = mergeCanvasImport(prev, [assignment({ id: 'a1', due: '2026-10-09T06:59:00.000Z' })]);

    const a = r.assignments[0];
    assert.equal(a.due, '2026-10-09T06:59:00.000Z', 'the new deadline is the point of refreshing');
    assert.equal(a.estimatedMinutes, 240, 'the corrected estimate is learned, and Canvas does not know it');
    assert.equal(r.updated, 1);
  });

  test('an untouched assignment takes the fresh estimate', () => {
    // Nothing has been learned about it, so a re-titled assignment should get
    // the seed its new title implies rather than keeping a guess from the old.
    const prev = { courses, assignments: [assignment({ id: 'a1', estimatedMinutes: 120 })] };
    const r = mergeCanvasImport(prev, [
      assignment({ id: 'a1', title: 'Final Exam', kind: 'exam', estimatedMinutes: 450 }),
    ]);
    assert.equal(r.assignments[0].estimatedMinutes, 450);
  });

  test('an assignment that left Canvas and was never worked on is dropped', () => {
    const prev = { courses, assignments: [assignment({ id: 'a1' }), assignment({ id: 'a2' })] };
    const r = mergeCanvasImport(prev, [assignment({ id: 'a1' })]);

    assert.equal(r.removed, 1);
    assert.deepEqual(r.removedIds, ['a2']);
    assert.ok(!r.assignments.some((a) => a.id === 'a2'));
  });

  test('an assignment that left Canvas but has minutes against it is kept', () => {
    // Those minutes are the only record of the work anywhere, and the duration
    // learning reads them. Unpublishing an assignment must not erase history.
    const prev = {
      courses,
      assignments: [assignment({ id: 'a2', status: 'done', actualMinutes: 60 })],
    };
    const r = mergeCanvasImport(prev, []);
    assert.equal(r.removed, 0);
    assert.equal(r.assignments.length, 1);
  });

  test('started work that left Canvas is kept but no longer planned', () => {
    // Found by scripts/refresh-week.ts, not by a test: the record was kept, the
    // status stayed `todo`, and the planner went on booking sessions for
    // homework the instructor had deleted.
    const prev = {
      courses,
      assignments: [assignment({ id: 'a2', actualMinutes: 115, lastTouched: '2026-10-01T00:00:00.000Z' })],
    };
    const r = mergeCanvasImport(prev, []);
    const a = r.assignments.find((x) => x.id === 'a2')!;
    assert.equal(a.status, 'dropped');
    assert.equal(a.actualMinutes, 115, 'the minutes are the only record of that work');
    assert.equal(r.retired, 1);
    assert.equal(r.removed, 0);
    assert.match(describeMerge(r)!, /no longer planned/);
  });

  test('a retired assignment loses its planned sessions, pinned too, and keeps its history', () => {
    const block = (id: string, status: StudyBlock['status'], pinned = false): StudyBlock => ({
      id, assignmentId: 'a2', commitmentId: null, course: 'CHEM 142', title: 'x',
      start: '2026-10-02T17:00:00.000Z', end: '2026-10-02T18:00:00.000Z', minutes: 60,
      method: 'practice problems', why: '', sessionIndex: 1, sessionCount: 3,
      status, actualMinutes: status === 'done' ? 60 : null, pinned,
    });
    const prev = {
      ...emptyState(),
      courses,
      assignments: [assignment({ id: 'a2', actualMinutes: 60, lastTouched: '2026-10-01T00:00:00.000Z' })],
      blocks: [block('done', 'done'), block('next', 'planned'), block('pinned', 'planned', true)],
    };
    const { next } = applyCanvas(prev, [], '2026-10-05T00:00:00.000Z');
    assert.deepEqual(next.blocks.map((b) => b.id), ['done']);
  });

  test('an untouched assignment that left Canvas takes every block with it', () => {
    const prev = {
      ...emptyState(),
      courses,
      assignments: [assignment({ id: 'a3' })],
      blocks: [{
        id: 'b', assignmentId: 'a3', commitmentId: null, course: 'CHEM 142', title: 'x',
        start: '2026-10-02T17:00:00.000Z', end: '2026-10-02T18:00:00.000Z', minutes: 60,
        method: 'practice problems' as const, why: '', sessionIndex: 1, sessionCount: 1,
        status: 'skipped' as const, actualMinutes: 0,
      }],
    };
    const { next } = applyCanvas(prev, [], '2026-10-05T00:00:00.000Z');
    assert.equal(next.blocks.length, 0, 'a skipped block for deleted work is an orphan, not history');
    assert.equal(next.canvasSyncedAt, '2026-10-05T00:00:00.000Z');
  });

  test('course colours are not repainted by a refresh', () => {
    // The palette decision: a student who has learned that blue is CHEM should
    // not have that taken away by pressing refresh.
    const prev = { courses, assignments: [assignment({ id: 'a1' })] };
    const r = mergeCanvasImport(prev, [
      assignment({ id: 'a1' }),
      assignment({ id: 'a2', course: 'MATH 124', courseFull: 'MATH 124 B' }),
    ]);

    assert.equal(r.courses.find((c) => c.code === 'CHEM 142')!.shade, 3);
    assert.notEqual(r.courses.find((c) => c.code === 'MATH 124')!.shade, 3);
  });

  test('assignments come back in due order', () => {
    const r = mergeCanvasImport({ courses: [], assignments: [] }, [
      assignment({ id: 'b', due: '2026-11-01T00:00:00.000Z' }),
      assignment({ id: 'a', due: '2026-10-01T00:00:00.000Z' }),
    ]);
    assert.deepEqual(r.assignments.map((a) => a.id), ['a', 'b']);
  });

  test('a refresh that changed nothing says nothing', () => {
    const prev = { courses, assignments: [assignment({ id: 'a1' })] };
    assert.equal(describeMerge(mergeCanvasImport(prev, [assignment({ id: 'a1' })])), null);
  });

  test('an empty feed does not wipe a term of work', () => {
    // Canvas returning nothing (a reset feed URL, a between-terms gap) must
    // not read as "every assignment was deleted". Untouched ones go, which is
    // recoverable by refreshing; anything worked on stays.
    const prev = {
      courses,
      assignments: [
        assignment({ id: 'a1', status: 'done', actualMinutes: 30 }),
        assignment({ id: 't-1' }),
        assignment({ id: 'a2' }),
      ],
    };
    const r = mergeCanvasImport(prev, []);
    assert.deepEqual(r.assignments.map((a) => a.id).sort(), ['a1', 't-1']);
  });
});

describe('when to fetch remembered calendars without being asked', () => {
  const now = new Date('2026-10-20T15:00:00.000Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

  test('once a day, with a margin so a same-time-every-morning student is not skipped', () => {
    assert.equal(dueForRefresh([{ fetchedAt: hoursAgo(19) }], now), false);
    assert.equal(dueForRefresh([{ fetchedAt: hoursAgo(20) }], now), true);
    assert.equal(dueForRefresh([{ fetchedAt: hoursAgo(23.9) }], now), true);
  });

  test('never with nothing remembered', () => {
    assert.equal(dueForRefresh([], now), false);
  });

  test('any one stale link is enough', () => {
    // A work schedule remembered today must not hold back a Canvas link from last week.
    assert.equal(dueForRefresh([{ fetchedAt: hoursAgo(1) }, { fetchedAt: hoursAgo(30) }], now), true);
  });

  test('a link with no fetch time is due, because its age is unknown', () => {
    assert.equal(dueForRefresh([{ fetchedAt: null }], now), true);
    assert.equal(dueForRefresh([{ fetchedAt: 'garbage' }], now), true);
  });

  test('a clock skewed into the future does not fetch in a loop', () => {
    assert.equal(dueForRefresh([{ fetchedAt: hoursAgo(-5) }], now), false);
  });
});

describe('when to say the deadlines are old', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

  test('says nothing before anything has been imported', () => {
    assert.equal(
      feedPrompt({ canvasSyncedAt: null, remembered: true, hasCourses: false, now }).kind,
      'none',
    );
  });

  test('says nothing when Canvas data exists but was never stamped', () => {
    // State written before `canvasSyncedAt` existed. Guessing an age would be
    // inventing a number, and the banner would be permanent.
    assert.equal(
      feedPrompt({ canvasSyncedAt: null, remembered: true, hasCourses: true, now }).kind,
      'none',
    );
  });

  test('with a remembered link, a prompt only appears once the daily fetch has failed for two days', () => {
    assert.equal(feedPrompt({ canvasSyncedAt: ago(1), remembered: true, hasCourses: true, now }).kind, 'none');
    const p = feedPrompt({ canvasSyncedAt: ago(2), remembered: true, hasCourses: true, now });
    assert.equal(p.kind, 'refresh');
    assert.equal(p.kind === 'refresh' && p.days, 2);
  });

  test('without one, a re-paste is asked for at three days', () => {
    // Instructors who post the week of the deadline make a week-old import
    // wrong, which is why this is no longer seven.
    assert.equal(feedPrompt({ canvasSyncedAt: ago(2), remembered: false, hasCourses: true, now }).kind, 'none');
    assert.equal(feedPrompt({ canvasSyncedAt: ago(3), remembered: false, hasCourses: true, now }).kind, 'repaste');
  });

  test('a timestamp in the future never produces a banner', () => {
    // Two devices with clocks a day apart is ordinary, and "last checked -1
    // days ago" is the kind of thing that ships.
    assert.equal(feedPrompt({ canvasSyncedAt: ago(-2), remembered: true, hasCourses: true, now }).kind, 'none');
  });

  test('an unparseable timestamp never produces a banner', () => {
    assert.equal(daysSince('not a date', now), 0);
    assert.equal(feedPrompt({ canvasSyncedAt: 'not a date', remembered: true, hasCourses: true, now }).kind, 'none');
  });
});
