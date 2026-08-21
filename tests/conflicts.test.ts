import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Commitment, FixedEvent, StudyBlock } from '../src/lib/types.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { collisionsWith, releaseForEvents, describeCollisions, overlaps } from '../src/lib/schedule/conflicts.ts';
import { zonedInstant, localParts } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
const MONDAY = zonedInstant('2026-10-05', 7 * 60, TZ);

const study: Commitment = {
  id: 'study', title: 'Study', category: 'learning', sessionsPerWeek: 5, minutesPerSession: 60,
  importance: 0.7, demand: 0.8, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
  minSessionMinutes: 30, bufferAfterMinutes: 0, windowStartMin: null, windowEndMin: null,
  active: true, color: '#e11d48',
};

function eventOver(b: StudyBlock, title = 'Dentist'): FixedEvent {
  return { id: 'ev', title, note: null, color: '#0891b2', start: b.start, end: b.end };
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
      id: 'ev2', title: 'Concert', note: null, color: '#8b5cf6',
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
