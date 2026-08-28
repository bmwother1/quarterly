import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Commitment, FixedEvent, StudyBlock } from '../src/lib/types.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { collisionsWith, releaseForEvents, describeCollisions, overlaps, pushAside, describeDisplaced } from '../src/lib/schedule/conflicts.ts';
import { zonedInstant, localParts } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
const MONDAY = zonedInstant('2026-10-05', 7 * 60, TZ);

const study: Commitment = {
  id: 'study', title: 'Study', category: 'learning', sessionsPerWeek: 5, minutesPerSession: 60,
  importance: 0.7, demand: 0.8, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
  minSessionMinutes: 30, bufferAfterMinutes: 0, windowStartMin: null, windowEndMin: null,
  active: true, shade: 0,
};

function eventOver(b: StudyBlock, title = 'Dentist'): FixedEvent {
  return { id: 'ev', title, note: null, category: 'personal', shade: 0, start: b.start, end: b.end };
}

describe('a one-off landing on planned work', () => {
  const first = planWeek([], defaultAvailability(), { tz: TZ, now: MONDAY, commitments: [study] });
  const target = first.blocks[0];

  test('the block moves, not the appointment', () => {
    // The event has a real time in the world; a study block does not. Only one
    // of the two can move, so there is no judgement call here.
    const dentist = eventOver(target);
    const after = planWeek([], defaultAvailability(), {
      tz: TZ, now: MONDAY, commitments: [study], events: [dentist],
    });

    assert.equal(after.blocks.filter((b) => overlaps(b, dentist)).length, 0);
    assert.ok(after.blocks.length > 0, 'the work should be rescheduled, not dropped');
  });

  test('a hand-placed block still loses to an appointment', () => {
    // The bug: pinned blocks were kept verbatim across a replan, so an event
    // dropped on one sat on top of it forever.
    const pinned: StudyBlock = { ...target, pinned: true };
    const dentist = eventOver(pinned);

    const clashes = collisionsWith([pinned], [dentist]);
    assert.equal(clashes.length, 1);
    assert.equal(clashes[0].wasPinned, true);

    const released = releaseForEvents([pinned], [dentist]);
    assert.equal(released[0].pinned, false, 'the pin has to be released or the planner cannot move it');

    const after = planWeek([], defaultAvailability(), {
      tz: TZ, now: MONDAY, commitments: [study], events: [dentist],
      existingBlocks: released.filter((b) => b.status !== 'planned'),
    });
    assert.equal(after.blocks.filter((b) => overlaps(b, dentist)).length, 0);
  });

  test('pins on blocks that do not clash are left alone', () => {
    // Releasing every pin would be a much worse bug than the one being fixed.
    const elsewhere: StudyBlock = { ...first.blocks[1], pinned: true };
    const dentist = eventOver(target);
    const released = releaseForEvents([elsewhere], [dentist]);
    assert.equal(released[0].pinned, true);
  });

  test('finished work is never moved to make room', () => {
    // A completed block is a record of what happened, not a plan. Rewriting it
    // to tidy the calendar would be falsifying history.
    const done: StudyBlock = { ...target, status: 'done', actualMinutes: 60 };
    assert.equal(collisionsWith([done], [eventOver(done)]).length, 0);
  });

  test('what moved is described in plain language', () => {
    const pinned: StudyBlock = { ...target, pinned: true };
    const withPin = describeCollisions(collisionsWith([pinned], [eventOver(pinned)]));
    assert.match(withPin!, /you'd placed it where Dentist is/);

    const plain = describeCollisions(collisionsWith([target], [eventOver(target)]));
    assert.match(plain!, /Moved Study around Dentist/);

    assert.equal(describeCollisions([]), null, 'silence when nothing had to move');
  });

  test('an event on a free evening moves nothing', () => {
    const quiet: FixedEvent = {
      id: 'ev2', title: 'Concert', note: null, category: 'personal', shade: 0,
      start: zonedInstant('2026-10-07', 20 * 60, TZ).toISOString(),
      end: zonedInstant('2026-10-07', 22 * 60, TZ).toISOString(),
    };
    const clashes = collisionsWith(first.blocks, [quiet]);
    if (clashes.length === 0) assert.equal(describeCollisions(clashes), null);
  });

  test('the rescheduled block lands somewhere sensible, not just anywhere', () => {
    const dentist = eventOver(target);
    const after = planWeek([], defaultAvailability(), {
      tz: TZ, now: MONDAY, commitments: [study], events: [dentist],
    });
    for (const b of after.blocks) {
      const p = localParts(new Date(b.start), TZ);
      assert.ok(p.minutesOfDay >= 8 * 60 && p.minutesOfDay < 22 * 60, `moved to ${p.hour}:00`);
    }
  });
});

describe('blocks push each other aside', () => {
  const DAY = '2026-09-15';
  function b(id: string, course: string, hour: number, minutes: number, status = 'planned'): StudyBlock {
    const start = new Date(`${DAY}T${String(hour).padStart(2, '0')}:00:00-07:00`);
    return {
      id, course, title: course, assignmentId: null, commitmentId: 'c',
      start: start.toISOString(),
      end: new Date(start.getTime() + minutes * 60_000).toISOString(),
      minutes, status, why: '', method: null, actualMinutes: null, pinned: false,
    } as unknown as StudyBlock;
  }
  const at = (blocks: StudyBlock[], id: string) =>
    new Date(blocks.find((x) => x.id === id)!.start).toISOString();

  test('a block dropped on another moves it down, not on top of it', () => {
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 9, 60)];
    const { blocks, displaced } = pushAside(before, 'a');

    assert.equal(displaced.length, 1);
    assert.equal(displaced[0].id, 'b');
    // CHEM starts where Run ends, rather than sharing the hour.
    assert.equal(at(blocks, 'b'), before[0].end);
  });

  test('the block the student moved never moves', () => {
    // It is the only thing on screen they just made a decision about.
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 9, 60)];
    const { blocks } = pushAside(before, 'a');
    assert.equal(at(blocks, 'a'), before[0].start);
  });

  test('a settled block is an obstruction, not something to shove', () => {
    // A finished block is a record of what happened. Moving it to tidy the
    // present is rewriting the past, so the displaced block goes around it.
    const done = b('done', 'Essay', 10, 60, 'done');
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 9, 60), done];
    const { blocks, displaced } = pushAside(before, 'a');

    assert.equal(at(blocks, 'done'), done.start, 'history stays put');
    assert.ok(displaced.some((d) => d.id === 'b'));
    // Pushed past the finished essay rather than onto it.
    assert.equal(at(blocks, 'b'), done.end);
  });

  test('two displaced blocks do not land on each other', () => {
    // The bug a single pass would have: both get pushed to the same free slot.
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 9, 30), b('c', 'MATH', 9, 30)];
    const { blocks } = pushAside(before, 'a');
    const bStart = at(blocks, 'b');
    const cStart = at(blocks, 'c');
    assert.notEqual(bStart, cStart);
  });

  test('nothing moves when nothing overlaps', () => {
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 14, 60)];
    const { blocks, displaced } = pushAside(before, 'a');
    assert.equal(displaced.length, 0);
    assert.equal(blocks, before, 'the same array, so React skips the re-render');
  });

  test('a push past the end of the day is refused rather than made at 2am', () => {
    // Silently moving work into the middle of the night is worse than an
    // overlap the student can see and fix.
    const before = [b('a', 'Run', 21, 60), b('b', 'CHEM', 21, 60)];
    const { displaced } = pushAside(before, 'a', { dayEndMin: 22 * 60 });
    assert.equal(displaced.length, 0);
  });

  test('it says what it moved', () => {
    const before = [b('a', 'Run', 9, 60), b('b', 'CHEM', 9, 60)];
    const { displaced } = pushAside(before, 'a');
    assert.match(describeDisplaced(displaced) ?? '', /CHEM/);
    assert.equal(describeDisplaced([]), null, 'silence when nothing moved');
  });
});
