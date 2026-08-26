import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { breakdownForDay, dominantCategory } from '../src/lib/schedule/day.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import type { Category } from '../src/lib/categories.ts';
import type { Availability, FixedEvent, StudyBlock } from '../src/lib/types.ts';

const TZ = 'America/Los_Angeles';
const DAY = '2026-09-15';

function block(course: string, hour: number, minutes: number): StudyBlock {
  const start = new Date(`${DAY}T${String(hour).padStart(2, '0')}:00:00-07:00`);
  return {
    id: `b-${course}-${hour}`, course, title: course, assignmentId: null, commitmentId: 'c',
    start: start.toISOString(), end: new Date(start.getTime() + minutes * 60_000).toISOString(),
    minutes, status: 'planned', why: '', method: null, actualMinutes: null,
  } as unknown as StudyBlock;
}

function event(title: string, category: Category, hour: number, hours: number): FixedEvent {
  const start = new Date(`${DAY}T${String(hour).padStart(2, '0')}:00:00-07:00`);
  return {
    id: `e-${title}`, title, note: null, category, shade: 0,
    start: start.toISOString(), end: new Date(start.getTime() + hours * 3_600_000).toISOString(),
  };
}

/** Sleep every night, which is what makes `wakingMinutes` a real denominator. */
function availability(): Availability {
  return defaultAvailability();
}

const colorFor = () => 'var(--accent)';

describe('what kind of day it is', () => {
  test('the category with the most minutes wins', () => {
    const b = breakdownForDay(
      DAY,
      [block('CHEM 142', 9, 60)],
      [event('Shift', 'work', 13, 8)],
      availability(), TZ, colorFor, () => 'deadline',
    );
    assert.equal(dominantCategory(b.byCategory), 'work');
  });

  test('sleep never wins, even though it is the longest thing in every day', () => {
    // Sleep is in `byCategory` because the breakdown counts it, and it would
    // dominate all 365 days. A month coloured entirely by sleep says nothing.
    const b = breakdownForDay(DAY, [], [], availability(), TZ, colorFor, () => 'deadline');
    assert.ok(b.byCategory.sleep > 0, 'sleep is counted');
    assert.equal(dominantCategory(b.byCategory), null, 'but it cannot be dominant');
  });

  test('a genuinely empty day has no category rather than a default one', () => {
    // Colouring an empty day would put a bar on it, which reads as work the
    // student has not been told about.
    const b = breakdownForDay(DAY, [], [], availability(), TZ, colorFor, () => 'deadline');
    assert.equal(dominantCategory(b.byCategory), null);
  });

  test('a tie goes to the thing the student still has to decide about', () => {
    // Two hours of coursework against two hours of shift. The shift is already
    // decided; the coursework is the thing they have to act on.
    const b = breakdownForDay(
      DAY,
      [block('CHEM 142', 9, 120)],
      [event('Shift', 'work', 13, 2)],
      availability(), TZ, colorFor, () => 'deadline',
    );
    assert.equal(b.byCategory.deadline, b.byCategory.work, 'the fixture must actually tie');
    assert.equal(dominantCategory(b.byCategory), 'deadline');
  });

  test('skipped blocks do not colour a day', () => {
    // A skipped block is time that did not happen. Counting it would show a
    // heavy day where the student actually did nothing.
    const skipped = { ...block('CHEM 142', 9, 240), status: 'skipped' } as StudyBlock;
    const b = breakdownForDay(DAY, [skipped], [], availability(), TZ, colorFor, () => 'deadline');
    assert.equal(b.byCategory.deadline, 0);
    assert.equal(dominantCategory(b.byCategory), null);
  });
});

describe('the bar is minutes, not a count', () => {
  test('one long deadline outweighs several short lectures', () => {
    // The whole reason this is a bar. Six one-hour lectures and one six-hour
    // problem set are the same number of events and nothing like the same day.
    const many = breakdownForDay(
      DAY, [],
      [1, 2, 3].map((i) => event(`Lecture ${i}`, 'class', 8 + i, 1)),
      availability(), TZ, colorFor, () => 'deadline',
    );
    const one = breakdownForDay(
      DAY, [block('CHEM 142', 9, 360)], [],
      availability(), TZ, colorFor, () => 'deadline',
    );

    const load = (b: { plannedMinutes: number; fixedMinutes: number }) =>
      b.plannedMinutes + b.fixedMinutes;

    assert.equal(many.events.length, 3);
    assert.equal(one.blocks.length, 1);
    assert.ok(load(one) > load(many), 'six hours must outweigh three events of one hour');
  });

  test('the day view and the month view cannot disagree', () => {
    // Both read the same breakdown. If the month derived its own workload the
    // two would drift the first time either changed, and a student would see a
    // full bar open onto a quiet day.
    const b = breakdownForDay(
      DAY, [block('CHEM 142', 9, 90)], [event('Shift', 'work', 13, 4)],
      availability(), TZ, colorFor, () => 'deadline',
    );
    const fromSegments = b.segments
      .filter((s) => s.kind === 'work' || s.kind === 'fixed')
      .reduce((t, s) => t + s.minutes, 0);
    assert.equal(fromSegments, b.plannedMinutes + b.fixedMinutes);
  });
});
