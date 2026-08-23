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
function withWork(lastSyncedAt: string | null = null, lastModifiedAt: string | null = null): QuarterlyState {
  const s = emptyState();
  s.commitments = [commitment()];
  s.lastSyncedAt = lastSyncedAt;
  s.lastModifiedAt = lastModifiedAt;
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

  test('a clean device pulls work done on another one', () => {
    // Phone edited at 10:00. This laptop synced at 09:00 and has not been
    // touched since, so it has nothing of its own to lose.
    const local = withWork('2026-08-23T09:00:00Z', '2026-08-23T08:00:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'pull');
  });

  test('both sides edited apart is a conflict, and nothing is chosen', () => {
    // Synced at 09:00. Since then this device edited at 09:30 and another wrote
    // at 10:00. There is no merge, so any automatic answer discards a real
    // week. Reporting the conflict and doing nothing keeps both.
    const local = withWork('2026-08-23T09:00:00Z', '2026-08-23T09:30:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'conflict');
  });

  test('local changes since the last sync are pushed', () => {
    // This device synced at 10:00 and the server has not moved since, so the
    // edits in front of us are the only new thing.
    const local = withWork('2026-08-23T10:00:00Z', '2026-08-23T10:30:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'push');
  });

  test('two devices level with each other do nothing', () => {
    const local = withWork('2026-08-23T10:00:00Z', '2026-08-23T09:00:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'nothing');
  });

  test('a week built offline is not thrown away on first sign-in', () => {
    // This was a silent data-loss path. A student used Quarterly signed out on
    // their phone for a week, then signed in to an account they had already
    // used elsewhere. `lastSyncedAt` was null, which parses to 0, so the server
    // always looked newer and the phone's week vanished with nothing said.
    const local = withWork(null, '2026-08-23T09:00:00Z');
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'conflict');
  });

  test('state written before lastModifiedAt existed is treated as dirty', () => {
    // Anyone already using the app has a stored blob with no modification
    // stamp. Assuming those are disposable would delete the weeks of the only
    // people who have ever used this.
    const local = withWork('2026-08-23T09:00:00Z', null);
    assert.equal(decideDirection(local, remote('2026-08-23T10:00:00Z')), 'conflict');
  });

  test('blocks alone are not content worth protecting', () => {
    // Blocks are regenerated from commitments and assignments. A state holding
    // only blocks has nothing a replan could not rebuild.
    const s = emptyState();
    s.blocks = [{ id: 'b1' } as never];
    assert.equal(hasContent(s), false);
  });
});
