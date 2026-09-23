/**
 * Fetching a calendar from a URL a stranger supplied, without becoming a proxy
 * into the network this runs inside.
 *
 * `fetch` cannot do this safely. It resolves the hostname itself, after any
 * check we could make, so a name that resolved to a public address during the
 * check can resolve to 169.254.169.254 a millisecond later (DNS rebinding). The
 * only sound version checks the address the socket actually connects to, which
 * means owning the lookup. `node:https` takes a `lookup` function; this one
 * resolves every address for the name, refuses the lot if any is private, and
 * hands the socket the one it checked.
 *
 * Redirects are followed by hand, at most three, each hop re-validated from
 * scratch. The previous version refused redirects outright, which was safe and
 * also meant any provider that redirects (iCloud moves accounts between
 * servers with exactly that) failed with no useful message.
 */

import https from 'node:https';
import dns from 'node:dns';
import zlib from 'node:zlib';
import type { LookupFunction } from 'node:net';
// Relative, not `@/`, so the tests can import this under plain node.
import { isPrivateAddress, validateFeedUrl } from '../../../lib/canvas/feed-url.ts';

export type FetchResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'blocked' | 'status' | 'timeout' | 'network' | 'too-large' | 'redirects'; status?: number };

/**
 * Resolve, check every address, connect only to a checked one.
 *
 * Node calls this with `all: true` when it wants to try several addresses
 * (happy eyeballs), and with `all` unset otherwise. Both shapes are answered.
 */
export const checkedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, family: options.family }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      const blocked = Object.assign(new Error(`refused private address for ${hostname}`), { code: 'EBLOCKED' });
      return callback(blocked, '', 4);
    }
    if ((options as { all?: boolean }).all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

function once(url: URL, timeoutMs: number, maxBytes: number): Promise<
  | { kind: 'body'; status: number; text: string }
  | { kind: 'redirect'; location: string }
  | { kind: 'fail'; reason: 'blocked' | 'timeout' | 'network' | 'too-large' }
> {
  return new Promise((resolve) => {
    const req = https.get(url, {
      lookup: checkedLookup,
      timeout: timeoutMs,
      headers: {
        accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5',
        'accept-encoding': 'gzip, deflate, br',
        'user-agent': 'Heron calendar import (+https://heron.study)',
      },
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ kind: 'redirect', location: res.headers.location });
      }

      const declared = Number(res.headers['content-length'] ?? 0);
      if (declared > maxBytes) {
        res.destroy();
        return resolve({ kind: 'fail', reason: 'too-large' });
      }

      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase();
      const stream =
        enc === 'gzip' ? res.pipe(zlib.createGunzip()) :
        enc === 'deflate' ? res.pipe(zlib.createInflate()) :
        enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) :
        res;

      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (c: Buffer) => {
        size += c.length;
        // Counted after decompression, so a small gzip bomb cannot slip past.
        if (size > maxBytes) {
          res.destroy();
          resolve({ kind: 'fail', reason: 'too-large' });
          return;
        }
        chunks.push(c);
      });
      stream.on('end', () => resolve({ kind: 'body', status, text: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', () => resolve({ kind: 'fail', reason: 'network' }));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ kind: 'fail', reason: 'timeout' });
    });
    req.on('error', (e: NodeJS.ErrnoException) => {
      resolve({ kind: 'fail', reason: e.code === 'EBLOCKED' ? 'blocked' : 'network' });
    });
  });
}

export async function fetchCalendar(
  start: URL,
  opts: { timeoutMs: number; maxBytes: number; maxRedirects?: number },
): Promise<FetchResult> {
  // Validated here as well as by the caller. Node skips the lookup entirely for
  // an IP-literal host, so for `https://10.0.0.5/` this check is the only one.
  const first = validateFeedUrl(start.toString());
  if (!first.ok) return { ok: false, reason: 'blocked' };
  let url = first.url;
  const hops = opts.maxRedirects ?? 3;

  for (let i = 0; i <= hops; i++) {
    const r = await once(url, opts.timeoutMs, opts.maxBytes);
    if (r.kind === 'fail') return { ok: false, reason: r.reason };
    if (r.kind === 'body') {
      return r.status >= 200 && r.status < 300
        ? { ok: true, text: r.text }
        : { ok: false, reason: 'status', status: r.status };
    }
    // Every hop gets the same checks as the link the student pasted.
    const next = validateFeedUrl(new URL(r.location, url).toString());
    if (!next.ok) return { ok: false, reason: 'blocked' };
    url = next.url;
  }
  return { ok: false, reason: 'redirects' };
}
