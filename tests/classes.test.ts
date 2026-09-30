import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { BusyBlock } from '../src/lib/types.ts';
import { classClashes, classesOf, classGroup, mapUrl } from '../src/lib/classes.ts';

const cls = (group: string, day: number, startMin: number, endMin: number, label: string, location?: string): BusyBlock =>
  ({ id: `${group}-${day}`, day, startMin, endMin, label, kind: 'class', location });

// Brydon's own week, as typed: MGMT 305 ran to 12:50 and EE 454 starts 12:30.
const busy: BusyBlock[] = [
  cls('class-1', 1, 630, 770, 'MGMT 305A'), cls('class-1', 3, 630, 770, 'MGMT 305A'),
  cls('class-2', 1, 750, 860, 'EE 454A', 'LOW 201'), cls('class-2', 3, 750, 860, 'EE 454A', 'LOW 201'),
  { id: 'sleep-1', day: 1, startMin: 0, endMin: 390, label: 'Sleep', kind: 'sleep' },
];

describe('classes entered in Setup', () => {
  test('grouped back into one entry per class, with its days and room', () => {
    const list = classesOf(busy);
    assert.deepEqual(list.map((c) => [c.label, c.days, c.location]), [
      ['MGMT 305A', [1, 3], null], ['EE 454A', [1, 3], 'LOW 201'],
    ]);
    assert.equal(classGroup('class-1727712345-6'), 'class-1727712345');
  });

  test('an overlap is caught, by name', () => {
    assert.deepEqual(classClashes(busy, { days: [1], startMin: 630, endMin: 770 }, 'class-1'), ['EE 454A']);
  });

  test('back to back is not an overlap, another day is not, and a class never clashes with itself', () => {
    assert.deepEqual(classClashes(busy, { days: [1], startMin: 700, endMin: 750 }), ['MGMT 305A']);
    assert.deepEqual(classClashes(busy, { days: [1], startMin: 860, endMin: 920 }), []);
    assert.deepEqual(classClashes(busy, { days: [2], startMin: 630, endMin: 770 }), []);
    assert.deepEqual(classClashes(busy, { days: [1, 3], startMin: 750, endMin: 860 }, 'class-2'), ['MGMT 305A']);
  });

  test('sleep and work are not classes', () => {
    assert.deepEqual(classClashes(busy, { days: [1], startMin: 0, endMin: 60 }), []);
  });
});

describe('map links', () => {
  test('a UW building code opens the campus map on that building', () => {
    assert.equal(mapUrl('LOW 201'), 'https://www.washington.edu/maps/?l=LOW');
    assert.equal(mapUrl('ECE 105'), 'https://www.washington.edu/maps/?l=ECE');
  });
  test('anything else is searched as written', () => {
    assert.match(mapUrl('Suzzallo Library, room 102'), /google\.com\/maps\/search\/\?api=1&query=Suzzallo%20Library/);
  });
});
