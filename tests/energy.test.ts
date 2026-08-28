import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_OBSERVATIONS, OVERRIDE_MIN_OBSERVATIONS,
  effectiveEnergy, inferEnergyPattern,
} from '../src/lib/schedule/observed.ts';
import type { StudyBlock } from '../src/lib/types.ts';

const TZ = 'America/Los_Angeles';

/** `n` blocks at a given local hour, a share of them finished. */
function blocksAt(hour: number, n: number, completedShare: number, dayOffset = 0): StudyBlock[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 1 + dayOffset + i));
    d.setUTCHours(hour + 7, 0, 0, 0); // PDT is UTC-7
    return {
      id: `b-${hour}-${dayOffset}-${i}`, course: 'CHEM 142', title: 'Work',
      assignmentId: 'a1', commitmentId: null,
      start: d.toISOString(), end: new Date(d.getTime() + 3_600_000).toISOString(),
      minutes: 60, why: '', method: null, pinned: false,
      status: i < Math.round(n * completedShare) ? 'done' : 'skipped',
      actualMinutes: i < Math.round(n * completedShare) ? 60 : null,
    } as unknown as StudyBlock;
  });
}

/** A clear morning person: finishes in the morning, not in the evening. */
function morningPerson(perWindow: number): StudyBlock[] {
  return [...blocksAt(9, perWindow, 0.95, 0), ...blocksAt(20, perWindow, 0.15, 60)];
}

describe('what a student does versus what they said', () => {
  test('says nothing at all below the mention threshold', () => {
    assert.equal(inferEnergyPattern(blocksAt(9, 3, 1), TZ), null);
  });

  test('mentioning a pattern is a much lower bar than acting on it', () => {
    // The gap between the two thresholds is the whole design. Eight blocks is
    // one bad week, and one bad week is exactly when a real pattern looks worst.
    assert.ok(OVERRIDE_MIN_OBSERVATIONS > MIN_OBSERVATIONS * 2);
  });

  test('enough evidence to mention is not enough to overrule', () => {
    const blocks = morningPerson(5); // 10 observations: past mention, under override
    const inferred = inferEnergyPattern(blocks, TZ);
    assert.ok(inferred, 'Insights would show this');
    assert.equal(inferred!.pattern, 'morning');

    const effective = effectiveEnergy({ energy: 'evening' }, blocks, TZ);
    assert.equal(effective.source, 'declared', 'the scheduler keeps what they chose');
    assert.equal(effective.pattern, 'evening');
  });

  test('plenty of clear evidence does overrule', () => {
    const blocks = morningPerson(15); // 30 observations
    const effective = effectiveEnergy({ energy: 'evening' }, blocks, TZ);
    assert.equal(effective.source, 'observed');
    assert.equal(effective.pattern, 'morning');
    assert.ok(effective.observations >= OVERRIDE_MIN_OBSERVATIONS);
  });

  test('agreeing is not overruling', () => {
    // Reporting an override when the two match would put a needless "we changed
    // this" in front of someone whose week did not change.
    const blocks = morningPerson(15);
    const effective = effectiveEnergy({ energy: 'morning' }, blocks, TZ);
    assert.equal(effective.source, 'declared');
    assert.equal(effective.pattern, 'morning');
  });

  test('a locked preference is never overruled, however much evidence there is', () => {
    // A student told what their blocks say who still chose otherwise has
    // answered. An app that keeps overruling them is arguing, not helping.
    const blocks = morningPerson(40);
    const effective = effectiveEnergy({ energy: 'evening', energyLocked: true }, blocks, TZ);
    assert.equal(effective.source, 'declared');
    assert.equal(effective.pattern, 'evening');
  });

  test('a muddy signal is left alone even with lots of blocks', () => {
    // Volume is not evidence. Equal completion at both ends separates nothing,
    // and rescheduling someone's week on noise is the expensive mistake here.
    const muddy = [...blocksAt(9, 20, 0.6, 0), ...blocksAt(20, 20, 0.6, 60)];
    const effective = effectiveEnergy({ energy: 'evening' }, muddy, TZ);
    assert.equal(effective.source, 'declared');
    assert.ok(effective.observations >= OVERRIDE_MIN_OBSERVATIONS, 'plenty of blocks');
  });

  test('evidence at only one end of the day proves nothing', () => {
    // Someone who only ever schedules mornings has no evening data to compare
    // against, so a high morning rate says nothing about their pattern.
    const oneSided = blocksAt(9, 40, 0.9);
    assert.equal(inferEnergyPattern(oneSided, TZ), null);
    assert.equal(effectiveEnergy({ energy: 'evening' }, oneSided, TZ).source, 'declared');
  });

  test('no history at all keeps the declared value', () => {
    const effective = effectiveEnergy({ energy: 'steady' }, [], TZ);
    assert.equal(effective.source, 'declared');
    assert.equal(effective.pattern, 'steady');
    assert.equal(effective.observations, 0);
  });
});
