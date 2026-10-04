import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { StudyBlock } from '../src/lib/types.ts';
import { applyMakeUp, makeUpOptions } from '../src/lib/schedule/make-up.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { localParts, zonedInstant } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';
const NOW = zonedInstant('2026-10-07', 18 * 60, TZ);   // Wednesday 6 PM

function at(day: string, min: number): string {
  return zonedInstant(day, min, TZ).toISOString();
}

function block(over: Partial<StudyBlock> & { id: string; day: string; startMin: number; minutes?: number }): StudyBlock {
  const minutes = over.minutes ?? 60;
  const { day, startMin, ...rest } = over;
  return {
    assignmentId: null, commitmentId: 'study', course: 'Study', title: 'Study',
    start: at(day, startMin), end: at(day, startMin + minutes),
    minutes, method: 'work session', why: 'Weekly goal.',
    sessionIndex: 1, sessionCount: 1, status: 'planned', actualMinutes: null, ...rest,
  };
}

const skipped = () => block({ id: 'skip', day: '2026-10-07', startMin: 17 * 60, status: 'skipped' });
const state = (blocks: StudyBlock[], extra: Partial<{ events: never[] }> = {}) =>
  ({ blocks, availability: defaultAvailability(), events: [], ...extra });

function hm(iso: string): string {
  const p = localParts(new Date(iso), TZ);
  return `${p.dateKey} ${Math.floor(p.minutesOfDay / 60)}:${String(p.minutesOfDay % 60).padStart(2, '0')}`;
}

describe('making up a skipped goal session', () => {
  test('tomorrow has none: offers tomorrow first, at the same time of day', () => {
    const s = state([skipped(), block({ id: 'sat', day: '2026-10-10', startMin: 10 * 60 })]);
    const o = makeUpOptions(s, 'skip', NOW, TZ);
    assert.deepEqual(o.map((x) => x.kind), ['tomorrow', 'extend']);
    assert.equal(hm(o[0].start), '2026-10-08 17:00');
  });

  test('tomorrow already has one: offers adding to it, not a second session tomorrow', () => {
    const s = state([skipped(), block({ id: 'thu', day: '2026-10-08', startMin: 9 * 60 })]);
    const o = makeUpOptions(s, 'skip', NOW, TZ);
    assert.deepEqual(o.map((x) => x.kind), ['extend']);
    assert.equal(o[0].kind === 'extend' && o[0].targetId, 'thu');
    assert.equal(o[0].minutes, 120);
    assert.equal(hm(o[0].end), '2026-10-08 11:00');
  });

  test('extends before the session when something sits right after it', () => {
    const s = state([
      skipped(),
      block({ id: 'thu', day: '2026-10-08', startMin: 9 * 60 }),
      block({ id: 'hw', day: '2026-10-08', startMin: 10 * 60, commitmentId: null, assignmentId: 'hw' }),
    ]);
    const o = makeUpOptions(s, 'skip', NOW, TZ);
    assert.equal(hm(o[0].start), '2026-10-08 8:00');
    assert.equal(hm(o[0].end), '2026-10-08 10:00');
  });

  test('offers no extension when neither side is free', () => {
    const s = state([
      skipped(),
      block({ id: 'thu', day: '2026-10-08', startMin: 8 * 60 }),          // day starts at 8
      block({ id: 'hw', day: '2026-10-08', startMin: 9 * 60, commitmentId: null, assignmentId: 'hw' }),
    ]);
    assert.deepEqual(makeUpOptions(s, 'skip', NOW, TZ), []);
  });

  test('never runs a session past the end of the day', () => {
    const s = state([skipped(), block({ id: 'thu', day: '2026-10-08', startMin: 21 * 60 })]);
    const o = makeUpOptions(s, 'skip', NOW, TZ);
    assert.equal(hm(o[0].start), '2026-10-08 20:00');
    assert.equal(hm(o[0].end), '2026-10-08 22:00');
  });

  test('moves off the same time tomorrow when that time is taken', () => {
    const s = state([
      skipped(),
      block({ id: 'hw', day: '2026-10-08', startMin: 16 * 60 + 30, minutes: 90, commitmentId: null, assignmentId: 'hw' }),
    ]);
    const o = makeUpOptions(s, 'skip', NOW, TZ);
    assert.equal(o[0].kind, 'tomorrow');
    const start = Date.parse(o[0].start);
    const end = Date.parse(o[0].end);
    const hwStart = Date.parse(at('2026-10-08', 16 * 60 + 30));
    const hwEnd = Date.parse(at('2026-10-08', 18 * 60));
    assert.ok(end <= hwStart || start >= hwEnd, 'overlaps the homework block');
    assert.equal(localParts(new Date(start), TZ).dateKey, '2026-10-08');
  });

  test('coursework gets no make-up offers', () => {
    const s = state([block({ id: 'skip', day: '2026-10-07', startMin: 17 * 60, commitmentId: null, assignmentId: 'hw', status: 'skipped' })]);
    assert.deepEqual(makeUpOptions(s, 'skip', NOW, TZ), []);
  });
});

describe('applying a make-up', () => {
  test('extending pins the session and says why it is longer', () => {
    const blocks = [skipped(), block({ id: 'thu', day: '2026-10-08', startMin: 9 * 60 })];
    const [offer] = makeUpOptions(state(blocks), 'skip', NOW, TZ);
    const out = applyMakeUp(blocks, 'skip', offer, TZ);
    const thu = out.find((b) => b.id === 'thu')!;
    assert.equal(thu.minutes, 120);
    assert.equal(thu.pinned, true);
    assert.match(thu.why, /skipped/);
    assert.equal(out.length, 2);
    assert.equal(out.find((b) => b.id === 'skip')!.status, 'skipped');
  });

  test('tomorrow adds one planned block and leaves the skip on record', () => {
    const blocks = [skipped()];
    const [offer] = makeUpOptions(state(blocks), 'skip', NOW, TZ);
    const out = applyMakeUp(blocks, 'skip', offer, TZ);
    assert.equal(out.length, 2);
    const made = out.find((b) => b.id !== 'skip')!;
    assert.equal(made.status, 'planned');
    assert.equal(made.commitmentId, 'study');
    assert.equal(made.pinned, true);
    assert.equal(out.find((b) => b.id === 'skip')!.status, 'skipped');
    // Applying twice does not book two.
    assert.equal(applyMakeUp(out, 'skip', offer, TZ).length, 2);
  });
});
