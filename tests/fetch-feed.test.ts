import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { checkedLookup, fetchCalendar } from '../src/app/api/feed/fetch-feed.ts';

/**
 * The connect-time half of the SSRF defence. Offline on purpose: `localhost`
 * resolves from the hosts file, so these run without a network and prove the
 * refusal happens at the address, after DNS, which is where rebinding lives.
 */

describe('connecting only to checked addresses', () => {
  test('a name that resolves to loopback is refused at lookup', async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      checkedLookup('localhost', {}, (e) => resolve(e));
    });
    assert.equal(err?.code, 'EBLOCKED');
  });

  test('the same holds when node asks for every address', async () => {
    const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      checkedLookup('localhost', { all: true } as never, (e) => resolve(e));
    });
    assert.equal(err?.code, 'EBLOCKED');
  });

  test('an IP literal never reaches a socket, since node skips lookup for those', async () => {
    for (const u of ['https://127.0.0.1/x.ics', 'https://169.254.169.254/latest/meta-data', 'https://[::1]/x.ics']) {
      const r = await fetchCalendar(new URL(u), { timeoutMs: 2000, maxBytes: 1000 });
      assert.deepEqual(r, { ok: false, reason: 'blocked' }, u);
    }
  });
});
