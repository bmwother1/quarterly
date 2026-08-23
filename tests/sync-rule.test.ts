import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { emptyState, type QuarterlyState } from '../src/lib/store.ts';
import { decideDirection, hasContent, type RemoteMeta } from '../src/lib/sync-rule.ts';
import type { Commitment } from '../src/lib/types.ts';

function commitment(): Commitment {
  return {
    id: 'c1', title: 'Study', category: 'learning', sessionsPerWeek: 3, minutesPerSession: 60,
    importance: 0.7, demand: 0.8, lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
    minSessionMinutes: 30, bufferAfterMinutes: 0, windowStartMin: null, windowEndMin: null,
    active: true, color: '#2a78d6',
  };
}

/** A device with a real week on it. */
function withWork(lastSyncedAt: string | null = null): QuarterlyState {
  const s = emptyState();
  s.commitments = [commitment()];
  s.lastSyncedAt = lastSyncedAt;
  return s;
}

function remote(updatedAt: string, content = true): RemoteMeta {
  return { updatedAt, hasContent: content };
}

describe('which copy of a week wins', () => {
  test('a fresh install signing in pulls, and never pushes its emptiness', () => {
    // The whole reason this rule exists. Getting this backwards deletes a
    // student's entire schedule and nothing anywhere would report it.
    const decision = decideDirection(emptyState(), remote('2026-08-23T10:00:00Z'));
    assert.equal(decision, 'pull');
  });

  test('an empty device and an empty account do nothing', () => {
    assert.equal(
      decideDirection(emptyState(), remote('2026-08-23T10:00:00Z', false)),
      'nothing',
    );
  });

  test('first device with a week creates the server copy', () => {
    assert.equal(decideDirection(withWork(), null), 'push');
  });

  test('an empty first device has nothing to create it with', () => {
    assert.equal(decideDirection(emptyState(), null), 'nothing');
  });

  test('a second device that changed elsewhere wins over the one in front of you', () => {
    // Phone edited at 10:00. This laptop last synced at 09:00, so the server
    // holds work this device has never seen. Pushing would discard it.
    const local = withWork('2026-08-23T09:00:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'pull');
  });

  test('local changes since the last sync are pushed', () => {
    // This device synced at 10:00 and the server has not moved since, so the
    // edits in front of us are the only new thing.
    const local = withWork('2026-08-23T10:00:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'push');
  });

  test('KNOWN GAP: offline work is lost when signing in to an account that has data', () => {
    // Not a passing behaviour, a recorded one. `lastSyncedAt` is null on a
    // device that has never synced, which parses to 0, so any remote timestamp
    // looks newer and wins. That is correct for a fresh install and wrong here:
    // a student who used Quarterly signed-out for a week on their phone, then
    // signed in to an account they'd already used on a laptop, loses the phone's
    // week with nothing to tell them.
    //
    // The fix is a `lastModifiedAt` on the store, so "this device has unsynced
    // edits" stops being inferred from "this device has never synced". Until
    // that exists this test is here to stop the behaviour changing by accident.
    const local = withWork(null);
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'pull');
  });

  test('blocks alone are not content worth protecting', () => {
    // Blocks are regenerated from commitments and assignments. A state holding
    // only blocks has nothing a replan could not rebuild.
    const s = emptyState();
    s.blocks = [{ id: 'b1' } as never];
    assert.equal(hasContent(s), false);
  });
});
