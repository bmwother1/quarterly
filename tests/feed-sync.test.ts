import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Calendar links synced to the account. The expensive mistakes here all run
 * cleanly: a link the student revoked on one device quietly returning from
 * another, a link saved before signing in quietly vanishing, or a link that sits
 * in the database readable by anyone holding a dump.
 */

class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const storage = new FakeStorage();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  addEventListener() {},
  removeEventListener() {},
};

const { feedStore, readFeeds } = await import('../src/lib/feed-store.ts');
type Feed = import('../src/lib/feed-store.ts').RememberedFeed;
type Change = import('../src/lib/feed-store.ts').FeedChange;
const { reconcileFeeds } = await import('../src/lib/feed-sync-rule.ts');
const { keysFrom, linkId, seal, unseal } = await import('../src/app/api/feeds/seal.ts');

const CANVAS = 'https://canvas.uw.edu/feeds/calendars/user_SECRETTOKEN.ics';
const CANVAS_RESET = 'https://canvas.uw.edu/feeds/calendars/user_NEWTOKEN.ics';
const WORK = 'https://app.wheniwork.com/ical/SHIFTTOKEN.ics';

function feed(url: string, over: Partial<Feed> = {}): Feed {
  const canvas = url.includes('canvas');
  return {
    url, host: new URL(url).host, label: canvas ? 'Canvas' : 'When I Work',
    kind: canvas ? 'assignments' : 'events', sourceKey: canvas ? null : 'app.wheniwork.com#My Shifts',
    rememberedAt: '2026-09-20T10:00:00.000Z', fetchedAt: '2026-09-20T10:00:00.000Z', synced: true,
    ...over,
  };
}

describe('reconciling a device with the account', () => {
  test('a link forgotten on another device is not brought back', () => {
    const r = reconcileFeeds([feed(CANVAS, { synced: true })], []);
    assert.deepEqual(r.list, []);
    assert.deepEqual(r.upload, []);
  });

  test('a link saved here before signing in is kept and uploaded', () => {
    const mine = feed(WORK, { synced: false });
    const r = reconcileFeeds([mine], [feed(CANVAS)]);
    assert.deepEqual(r.list.map((f) => f.url).sort(), [CANVAS, WORK].sort());
    assert.deepEqual(r.upload.map((f) => f.url), [WORK]);
  });

  test('a phone with nothing gets the laptop\'s links', () => {
    const r = reconcileFeeds([], [feed(CANVAS), feed(WORK)]);
    assert.equal(r.list.length, 2);
    assert.ok(r.list.every((f) => f.synced));
  });

  test('a newer Canvas link saved here replaces the account\'s, on the account too', () => {
    const newer = feed(CANVAS_RESET, { synced: false, rememberedAt: '2026-09-22T10:00:00.000Z' });
    const r = reconcileFeeds([newer], [feed(CANVAS)]);
    assert.deepEqual(r.list.map((f) => f.url), [CANVAS_RESET]);
    assert.deepEqual(r.upload.map((f) => f.url), [CANVAS_RESET]);
    assert.deepEqual(r.remove, [CANVAS]);
  });

  test('an older Canvas link saved here loses to the account\'s', () => {
    const older = feed(CANVAS_RESET, { synced: false, rememberedAt: '2026-09-01T10:00:00.000Z' });
    const r = reconcileFeeds([older], [feed(CANVAS)]);
    assert.deepEqual(r.list.map((f) => f.url), [CANVAS]);
    assert.deepEqual(r.upload, []);
    assert.deepEqual(r.remove, []);
  });

  test('the later fetch time wins, so a phone does not refetch what the laptop just did', () => {
    const r = reconcileFeeds(
      [feed(CANVAS, { fetchedAt: '2026-09-23T08:00:00.000Z' })],
      [feed(CANVAS, { fetchedAt: '2026-09-21T08:00:00.000Z' })],
    );
    assert.equal(r.list[0].fetchedAt, '2026-09-23T08:00:00.000Z');
  });
});

describe('what the store reports to the account', () => {
  let seen: Change[] = [];
  beforeEach(() => {
    storage.clear();
    feedStore.replaceAll([]);
    seen = [];
    feedStore.setMirror((c) => { seen.push(...c); });
  });

  test('remembering reports the link, unsynced until the account confirms it', () => {
    feedStore.remember({ url: CANVAS, label: 'Canvas', kind: 'assignments', sourceKey: null });
    assert.deepEqual(seen.map((c) => c.op), ['upsert']);
    assert.equal(feedStore.canvas()?.synced, false);
    feedStore.markSynced([CANVAS]);
    assert.equal(feedStore.canvas()?.synced, true);
  });

  test('a reset Canvas link deletes the old one from the account as well', () => {
    feedStore.remember({ url: CANVAS, label: 'Canvas', kind: 'assignments', sourceKey: null });
    seen = [];
    feedStore.remember({ url: CANVAS_RESET, label: 'Canvas', kind: 'assignments', sourceKey: null });
    assert.deepEqual(seen, [
      { op: 'delete', url: CANVAS },
      { op: 'upsert', feed: feedStore.canvas() },
    ]);
  });

  test('forget and Delete my data reach the account', () => {
    feedStore.remember({ url: CANVAS, label: 'Canvas', kind: 'assignments', sourceKey: null });
    feedStore.remember({ url: WORK, label: 'When I Work', kind: 'events', sourceKey: 'app.wheniwork.com#My Shifts' });
    seen = [];
    feedStore.forget(WORK);
    feedStore.forgetAll();
    assert.deepEqual(seen, [{ op: 'delete', url: WORK }, { op: 'delete', url: CANVAS }]);
  });

  test('a fetch is a touch, never an upsert that could revive a forgotten link', () => {
    feedStore.remember({ url: CANVAS, label: 'Canvas', kind: 'assignments', sourceKey: null });
    seen = [];
    feedStore.markFetched(CANVAS, '2026-09-23T09:00:00.000Z');
    assert.deepEqual(seen, [{ op: 'touch', url: CANVAS, fetchedAt: '2026-09-23T09:00:00.000Z' }]);
  });

  test('applying the account\'s list is not echoed back to it', () => {
    feedStore.replaceAll([feed(CANVAS)]);
    assert.deepEqual(seen, []);
  });

  test('signed out, nothing is reported anywhere', () => {
    feedStore.setMirror(null);
    feedStore.remember({ url: CANVAS, label: 'Canvas', kind: 'assignments', sourceKey: null });
    feedStore.forget(CANVAS);
    assert.deepEqual(seen, []);
  });

  test('a link stored before this change reads back as unsynced, so it gets uploaded', () => {
    const old: Partial<Feed> = feed(CANVAS);
    delete old.synced;
    storage.setItem('heron.feeds.v2', JSON.stringify([old]));
    assert.equal(readFeeds()[0].synced, false);
  });
});

describe('sealing a link for the database', () => {
  const keys = keysFrom(Buffer.alloc(32, 7).toString('base64'))!;
  const other = keysFrom(Buffer.alloc(32, 8).toString('base64'))!;
  const ALICE = '11111111-1111-1111-1111-111111111111';
  const BOB = '22222222-2222-2222-2222-222222222222';

  test('round-trips, and the stored form does not contain the token', () => {
    const sealed = seal(keys, ALICE, CANVAS);
    assert.equal(unseal(keys, ALICE, sealed), CANVAS);
    assert.doesNotMatch(sealed, /SECRETTOKEN|canvas/i);
  });

  test('the same link seals differently each time', () => {
    assert.notEqual(seal(keys, ALICE, CANVAS), seal(keys, ALICE, CANVAS));
  });

  test('a row copied into another account does not open', () => {
    assert.equal(unseal(keys, BOB, seal(keys, ALICE, CANVAS)), null);
  });

  test('a tampered row or the wrong key does not open', () => {
    const sealed = seal(keys, ALICE, CANVAS);
    const flipped = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'B' : 'A') + sealed.slice(-1);
    assert.equal(unseal(keys, ALICE, flipped), null);
    assert.equal(unseal(other, ALICE, sealed), null);
    assert.equal(unseal(keys, ALICE, 'garbage'), null);
  });

  test('the row id is stable per account and link, and reveals neither', () => {
    assert.equal(linkId(keys, ALICE, CANVAS), linkId(keys, ALICE, CANVAS));
    assert.notEqual(linkId(keys, ALICE, CANVAS), linkId(keys, BOB, CANVAS));
    assert.notEqual(linkId(keys, ALICE, CANVAS), linkId(keys, ALICE, CANVAS_RESET));
    assert.doesNotMatch(linkId(keys, ALICE, CANVAS), /SECRETTOKEN/);
  });

  test('a missing or short key means no sync rather than a weak one', () => {
    assert.equal(keysFrom(undefined), null);
    assert.equal(keysFrom(''), null);
    assert.equal(keysFrom(Buffer.alloc(16).toString('base64')), null);
  });
});
