import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { FixedEvent } from '../src/lib/types.ts';

/**
 * The claim this file defends is structural, not editorial: a remembered
 * calendar link cannot reach the server, because it is not in the object that
 * goes there.
 *
 * Worth testing rather than trusting, because the failure would be invisible.
 * Somebody adds `feedUrl` to `HeronState` for a good reason, everything keeps
 * working, and the credential is in `plan_state` and in every downloaded backup
 * from that commit on, with nothing on screen saying so.
 */

class FakeStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
  has(k: string) { return this.map.has(k); }
}

const storage = new FakeStorage();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: storage,
  addEventListener() {},
  removeEventListener() {},
};

const { feedStore, readFeeds } = await import('../src/lib/feed-store.ts');
const { emptyState, heronStore } = await import('../src/lib/store.ts');
const { toBackup } = await import('../src/lib/backup.ts');
const { replaceSourceEvents } = await import('../src/lib/calendar/import.ts');

const CANVAS = 'https://canvas.uw.edu/feeds/calendars/user_SECRETTOKEN.ics';
const WORK = 'https://app.wheniwork.com/ical/SHIFTTOKEN.ics';
const canvas = { url: CANVAS, label: 'Canvas', kind: 'assignments' as const, sourceKey: null };
const work = { url: WORK, label: 'When I Work', kind: 'events' as const, sourceKey: 'app.wheniwork.com#My Shifts' };

describe('remembered calendar links', () => {
  beforeEach(() => feedStore.forgetAll());

  test('nothing is remembered until something asks for it', () => {
    assert.deepEqual(feedStore.getSnapshot(), []);
  });

  test('each calendar keeps its own entry, with a host safe to put on screen', () => {
    feedStore.remember(canvas);
    feedStore.remember(work);
    const list = feedStore.getSnapshot();
    assert.equal(list.length, 2);
    assert.equal(feedStore.canvas()?.host, 'canvas.uw.edu');
    for (const f of list) assert.ok(!f.host.includes('TOKEN'), 'the path is the credential, so it must not be in the label');
  });

  test('a new Canvas link replaces the old one, since a student has exactly one', () => {
    // After a feed reset the old link fails forever. Keeping it beside the new
    // one would mean a daily failure nobody can explain.
    feedStore.remember(canvas);
    feedStore.remember({ ...canvas, url: 'https://canvas.uw.edu/feeds/calendars/user_NEW.ics' });
    assert.equal(feedStore.getSnapshot().filter((f) => f.kind === 'assignments').length, 1);
  });

  test('forgetting one link leaves the others', () => {
    feedStore.remember(canvas);
    feedStore.remember(work);
    feedStore.forget(WORK);
    assert.deepEqual(feedStore.getSnapshot().map((f) => f.label), ['Canvas']);
  });

  test('forgetting removes it from storage, not just from the snapshot', () => {
    feedStore.remember(canvas);
    feedStore.forgetAll();
    assert.deepEqual(feedStore.getSnapshot(), []);
    assert.ok(!storage.has('heron.feeds.v2'));
  });

  test('a link saved by the Canvas-only version is carried over, once', () => {
    storage.removeItem('heron.feeds.v2');
    storage.setItem('heron.feed.v1', JSON.stringify({ url: CANVAS, host: 'canvas.uw.edu', rememberedAt: '2026-09-21T00:00:00Z' }));
    const list = readFeeds();
    assert.equal(list.length, 1);
    assert.equal(list[0].kind, 'assignments');
    assert.equal(list[0].url, CANVAS);
    assert.ok(!storage.has('heron.feed.v1'), 'the old key is removed after the move');
    assert.equal(readFeeds().length, 1, 'and reading again does not duplicate it');
  });

  test('none of them are ever part of the state that syncs', () => {
    feedStore.remember(canvas);
    feedStore.remember(work);
    const synced = JSON.stringify(emptyState());
    assert.ok(!synced.includes('TOKEN'));
    assert.ok(!('feedUrl' in emptyState()));
  });

  test('none of them are ever part of a downloadable backup', () => {
    feedStore.remember(canvas);
    feedStore.remember(work);
    const backup = JSON.stringify(toBackup(emptyState()));
    assert.ok(!backup.includes('canvas.uw.edu') && !backup.includes('wheniwork'));
  });

  test('deleting everything takes every link with it', () => {
    // "Delete my data" leaving a live credential to a student's whole schedule
    // behind on the device is the worst thing on that page to get wrong.
    feedStore.remember(canvas);
    feedStore.remember(work);
    heronStore.clear();
    assert.deepEqual(feedStore.getSnapshot(), []);
  });
});

describe('re-importing one calendar', () => {
  const ev = (id: string, source: string | null | undefined, start = '2026-10-12T17:00:00.000Z'): FixedEvent => ({
    id, title: id, start, end: start, note: null, category: 'work', shade: 0, ...(source !== undefined ? { source } : {}),
  });

  test('replaces that calendar and leaves every other one alone', () => {
    // The bug: importing a work schedule deleted the class timetable, because
    // "was imported" was all an event knew about where it came from.
    const current = [
      ev('e-1', undefined),                          // typed by hand
      ev('imp-class', 'calendar.google.com#UW'),     // timetable
      ev('imp-shift-old', 'app.wheniwork.com#Shifts'),
    ];
    const next = replaceSourceEvents(current, 'app.wheniwork.com#Shifts', [ev('imp-shift-new', null)]);
    assert.deepEqual(next.map((e) => e.id).sort(), ['e-1', 'imp-class', 'imp-shift-new']);
    assert.equal(next.find((e) => e.id === 'imp-shift-new')?.source, 'app.wheniwork.com#Shifts');
  });

  test('untagged events from before sources existed are replaced once, as they always were', () => {
    const next = replaceSourceEvents([ev('imp-legacy', undefined), ev('e-2', undefined)], 'x#y', []);
    assert.deepEqual(next.map((e) => e.id), ['e-2']);
  });
});
