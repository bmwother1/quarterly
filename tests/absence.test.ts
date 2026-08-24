import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { absence, releaseMissed } from '../src/lib/schedule/absence.ts';
import type { StudyBlock } from '../src/lib/types.ts';

const TZ = 'America/Los_Angeles';
const NOW = new Date('2026-08-24T12:00:00-07:00');

let n = 0;
function block(startLocal: string, minutes = 60, status: StudyBlock['status'] = 'planned'): StudyBlock {
  const start = new Date(startLocal);
  n += 1;
  return {
    id: `b${n}`,
    assignmentId: null,
    commitmentId: 'c1',
    course: 'Run',
    title: 'Run',
    start: start.toISOString(),
    end: new Date(start.getTime() + minutes * 60_000).toISOString(),
    minutes,
    method: 'practice' as StudyBlock['method'],
    why: 'because',
    sessionIndex: 1,
    sessionCount: 1,
    status,
    actualMinutes: null,
    pinned: false,
  } as StudyBlock;
}

describe('telling a skipped block apart from a week away', () => {
  test('nothing unanswered is not an absence', () => {
    const a = absence([block('2026-08-25T08:00:00-07:00')], NOW, TZ);
    assert.equal(a.kind, 'none');
    assert.equal(a.blocks.length, 0);
  });

  test('last night is a lapse, and still worth asking about', () => {
    // A student can tell you honestly whether they did this. Asking is useful.
    const a = absence([block('2026-08-23T19:00:00-07:00')], NOW, TZ);
    assert.equal(a.kind, 'lapse');
    assert.equal(a.daysSince, 1);
  });

  test('five days away is an absence, not fifteen questions', () => {
    // The case Brydon hit: away since the 18th, and the week opened demanding
    // an answer for every block in it.
    const blocks = [
      block('2026-08-19T08:00:00-07:00'), block('2026-08-19T17:00:00-07:00'),
      block('2026-08-20T08:00:00-07:00'), block('2026-08-21T08:00:00-07:00'),
      block('2026-08-22T08:00:00-07:00'),
    ];
    const a = absence(blocks, NOW, TZ);
    assert.equal(a.kind, 'away');
    assert.equal(a.days, 4, 'four distinct days');
    assert.equal(a.daysSince, 5);
  });

  test('a bad weekend is a lapse even when it is a lot of blocks', () => {
    // Volume alone does not make it an absence. Six blocks over two days is
    // still a stretch a student remembers.
    const blocks = [
      block('2026-08-23T08:00:00-07:00'), block('2026-08-23T12:00:00-07:00'),
      block('2026-08-23T17:00:00-07:00'), block('2026-08-24T07:00:00-07:00'),
    ];
    const a = absence(blocks, NOW, TZ);
    assert.equal(a.kind, 'lapse');
  });

  test('a few blocks spread over a long gap is still an absence', () => {
    // The other direction. Three blocks over eight days is an absence even
    // though there are fewer of them than a bad weekend.
    const blocks = [
      block('2026-08-16T08:00:00-07:00'),
      block('2026-08-19T08:00:00-07:00'),
      block('2026-08-22T08:00:00-07:00'),
    ];
    assert.equal(absence(blocks, NOW, TZ).kind, 'away');
  });

  test('already-answered blocks are not counted again', () => {
    const blocks = [
      block('2026-08-19T08:00:00-07:00', 60, 'done'),
      block('2026-08-20T08:00:00-07:00', 60, 'skipped'),
    ];
    assert.equal(absence(blocks, NOW, TZ).kind, 'none');
  });
});

describe('letting go of a week away', () => {
  test('released blocks are skipped, never done', () => {
    // Marking them done would flatter the completion rate that retention is
    // judged on, using time nobody spent.
    const blocks = [block('2026-08-19T08:00:00-07:00'), block('2026-08-25T08:00:00-07:00')];
    const after = releaseMissed(blocks, NOW);

    assert.equal(after[0].status, 'skipped');
    assert.equal(after[0].actualMinutes, 0, 'no time is claimed');
    assert.equal(after[1].status, 'planned', 'the future is left alone');
  });

  test('nothing is deleted', () => {
    // The record that the plan did not survive contact is the point. Erasing it
    // is how a planner becomes fiction.
    const blocks = [block('2026-08-19T08:00:00-07:00'), block('2026-08-20T08:00:00-07:00')];
    assert.equal(releaseMissed(blocks, NOW).length, 2);
  });

  test('work already marked done is untouched', () => {
    const blocks = [block('2026-08-19T08:00:00-07:00', 45, 'done')];
    const after = releaseMissed(blocks, NOW);
    assert.equal(after[0].status, 'done');
    assert.equal(after[0].actualMinutes, null, 'its own record is not overwritten');
  });
});
