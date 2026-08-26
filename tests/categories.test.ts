import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CATEGORIES, CATEGORY_META, DEFAULT_CATEGORY, EVENT_CATEGORIES,
  categoryForBusyKind, categoryForCommitment, categoryForImportedEvent,
  colorVar, isCategory, nextShade, takenShades,
} from '../src/lib/categories.ts';
import { coursesFrom } from '../src/lib/canvas/interpret.ts';
import type { Assignment } from '../src/lib/types.ts';

function assignment(course: string, courseFull = course): Assignment {
  return {
    id: `a-${course}`, title: 'Problem set', course, courseFull,
    kind: 'problem set', due: '2026-09-10T23:59:00Z', allDay: false, url: null,
    estimatedMinutes: 90, actualMinutes: 0, status: 'todo',
    weight: 0.1, confidence: 0.5, lastTouched: null,
  };
}

describe('mapping things onto categories', () => {
  test('busy kinds map straight across, and commitment falls to personal', () => {
    assert.equal(categoryForBusyKind('class'), 'class');
    assert.equal(categoryForBusyKind('work'), 'work');
    assert.equal(categoryForBusyKind('sleep'), 'sleep');
    assert.equal(categoryForBusyKind('commitment'), 'personal');
  });

  test('self-directed study is focus, not personal', () => {
    // The whole reason `focus` exists. Study you set yourself getting real hours
    // is what this product is for, and burying it next to a haircut makes the
    // month view say less than it could.
    assert.equal(categoryForCommitment('project'), 'focus');
    assert.equal(categoryForCommitment('learning'), 'focus');
    assert.equal(categoryForCommitment('fitness'), 'personal');
    assert.equal(categoryForCommitment('personal'), 'personal');
  });

  test('a Canvas feed always produces deadlines, whatever the title says', () => {
    // Canvas emits due dates. A title mentioning "lecture" must not turn an
    // assignment into fixed time the scheduler then refuses to plan around.
    assert.equal(categoryForImportedEvent('assignments', 'Lecture notes quiz'), 'deadline');
    assert.equal(categoryForImportedEvent('assignments', 'Anything at all'), 'deadline');
  });

  test('personal calendars are guessed from the title, and default broad', () => {
    assert.equal(categoryForImportedEvent('events', 'EE 371 Lecture'), 'class');
    assert.equal(categoryForImportedEvent('events', 'CHEM 142'), 'class');
    assert.equal(categoryForImportedEvent('events', 'Organic Chemistry Lab'), 'class');
    assert.equal(categoryForImportedEvent('events', 'Pro shop shift'), 'work');
    assert.equal(categoryForImportedEvent('events', 'Dentist'), DEFAULT_CATEGORY);
    assert.equal(categoryForImportedEvent('events', 'Mum'), DEFAULT_CATEGORY);
  });

  test('the course-code pattern stays case-sensitive', () => {
    // It was briefly folded into one case-insensitive regex with the word list,
    // which killed the words for every capitalised title. Making the code half
    // case-insensitive instead would turn "the 100 metres" into a course.
    assert.equal(categoryForImportedEvent('events', 'the 100 metres'), 'personal');
    assert.equal(categoryForImportedEvent('events', 'flat 220'), 'personal');
    assert.equal(categoryForImportedEvent('events', 'Run 5k'), 'personal');
  });

  test('a wrong guess is broad rather than confidently wrong', () => {
    // Anything unrecognised lands on `personal`, which is survivable and
    // editable. Guessing `class` for an unknown title would put a dentist
    // appointment in the same colour as a lecture, which reads as a bug.
    assert.equal(categoryForImportedEvent('events', 'zzzz'), 'personal');
  });
});

describe('shades', () => {
  test('fills the lowest free slot', () => {
    assert.equal(nextShade('deadline', []), 0);
    assert.equal(nextShade('deadline', [0]), 1);
    assert.equal(nextShade('deadline', [0, 1, 2]), 3);
  });

  test('removing one frees its slot rather than leaving a hole', () => {
    // Colour follows the entity. Deriving shade from list position would mean
    // deleting a course recolours every course after it.
    assert.equal(nextShade('deadline', [0, 2, 3]), 1);
  });

  test('past the family limit it reuses slot zero, never another family', () => {
    // A fifth course looking like the first is resolved by its label. A modulo
    // wrapping into the next family's variable would render a lecture in the
    // coursework colour, and nothing resolves that.
    assert.equal(nextShade('deadline', [0, 1, 2, 3]), 0);
    assert.equal(nextShade('sleep', [0]), 0);
    assert.equal(nextShade('work', [0, 1]), 0);
  });

  test('shade is clamped to the family, not wrapped', () => {
    assert.equal(colorVar('work', 5), 'var(--cat-work-1)');
    assert.equal(colorVar('sleep', 3), 'var(--cat-sleep-0)');
    assert.equal(colorVar('deadline', 2), 'var(--cat-deadline-2)');
    assert.equal(colorVar('class', -1), 'var(--cat-class-0)');
  });

  test('takenShades only counts the category asked about', () => {
    const items = [
      { category: 'deadline' as const, shade: 0 },
      { category: 'class' as const, shade: 0 },
      { category: 'deadline' as const, shade: 2 },
    ];
    assert.deepEqual(takenShades(items, 'deadline').sort(), [0, 2]);
    assert.deepEqual(takenShades(items, 'class'), [0]);
    assert.deepEqual(takenShades(items, 'work'), []);
  });
});

describe('courses keep their colour across a re-import', () => {
  test('a new course does not recolour the ones already there', () => {
    // Re-importing a feed rebuilds the course list. Assigning by position would
    // mean adding one course silently repaints the rest, so a student who has
    // learned blue means CHEM loses that to a sync.
    const first = coursesFrom([assignment('CHEM 142'), assignment('MATH 124')]);
    const chem = first.find((c) => c.code === 'CHEM 142')!;
    const math = first.find((c) => c.code === 'MATH 124')!;

    const second = coursesFrom(
      [assignment('CHEM 142'), assignment('MATH 124'), assignment('PHYS 121')],
      first,
    );

    assert.equal(second.find((c) => c.code === 'CHEM 142')!.shade, chem.shade);
    assert.equal(second.find((c) => c.code === 'MATH 124')!.shade, math.shade);
  });

  test('a dropped course frees its shade for the next one', () => {
    const first = coursesFrom([assignment('AAA 1'), assignment('BBB 2')]);
    const dropped = first.filter((c) => c.code === 'BBB 2');
    const next = coursesFrom([assignment('BBB 2'), assignment('CCC 3')], dropped);

    const shades = next.map((c) => c.shade);
    assert.equal(new Set(shades).size, 2, 'two courses, two distinct shades');
  });

  test('every course is a deadline, and they differ from each other', () => {
    const courses = coursesFrom(['A 1', 'B 2', 'C 3', 'D 4'].map((c) => assignment(c)));
    assert.ok(courses.every((c) => c.category === 'deadline'));
    assert.equal(new Set(courses.map((c) => c.shade)).size, 4);
  });
});

describe('the category set holds together', () => {
  test('every category has a CSS variable name and metadata', () => {
    for (const c of CATEGORIES) {
      assert.ok(CATEGORY_META[c], `${c} has no metadata`);
      assert.ok(CATEGORY_META[c].shades >= 1, `${c} needs at least one shade`);
      assert.match(colorVar(c, 0), /^var\(--cat-[a-z]+-0\)$/);
    }
  });

  test('only categories that are time already spoken for can be hand-added', () => {
    // `deadline` and `focus` are what the scheduler places into what is left.
    // Offering them as a fixed event would mean two things sharing a name and
    // behaving differently.
    assert.ok(!EVENT_CATEGORIES.includes('deadline'));
    assert.ok(!EVENT_CATEGORIES.includes('focus'));
    assert.ok(!EVENT_CATEGORIES.includes('sleep'));
    assert.ok(EVENT_CATEGORIES.includes(DEFAULT_CATEGORY), 'the default must be offerable');
  });

  test('isCategory rejects anything that is not one', () => {
    assert.ok(isCategory('deadline'));
    assert.ok(!isCategory('deadlines'));
    assert.ok(!isCategory(''));
    assert.ok(!isCategory(undefined));
  });
});
