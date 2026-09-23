/**
 * Validation for a student-supplied calendar feed URL.
 *
 * Lives apart from the route handler so it can be tested directly. This is what
 * stands between "fetch a URL server-side on request" and a server-side request
 * forgery hole, and untested security logic is decoration.
 *
 * **What changed, and why it is stronger rather than looser.** This used to be
 * an allowlist of four calendar providers, and that list was the whole SSRF
 * defence. It had two problems. It was a proxy for the real rule, which is
 * "never connect to a private or internal address", and a proxy can be wrong in
 * ways the rule cannot. And it turned away every student whose calendar lives
 * somewhere else: work schedules alone come from When I Work, 7shifts, Homebase,
 * Sling, Deputy, UKG and dozens more, several on per-employer domains no list
 * can keep up with.
 *
 * So the rule is now enforced where it actually applies, on the address:
 *   1. here, cheaply, on the URL: https, default port, no credentials, a public
 *      DNS name or a public IP literal;
 *   2. at connect time (`src/app/api/feed/fetch-feed.ts`), on every address the
 *      name resolves to, with the connection pinned to the address that was
 *      checked so DNS cannot answer differently a moment later;
 *   3. again on every redirect hop.
 *
 * Knowing the provider still matters, but for meaning rather than permission:
 * Canvas produces assignments, everything else produces events. That lives in
 * `src/lib/calendar/sources.ts`.
 */

import { identifySource } from '../calendar/sources.ts';

/** Names that can only ever mean this machine or its private network. */
export function isForbiddenHost(host: string): boolean {
  // `localhost.` with its trailing root dot is the same name as `localhost`.
  const h = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isIpLiteral(h)) return isPrivateAddress(h);
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    h.endsWith('.home.arpa') ||
    // A bare name with no dot resolves through search domains, which is to say
    // somewhere on the network this runs inside.
    !h.includes('.')
  );
}

function isIpLiteral(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
}

function parseV4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

function v4Private([a, b, c]: number[]): boolean {
  return (
    a === 0 ||                                   // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||        // carrier-grade NAT
    (a === 169 && b === 254) ||                  // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||         // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) ||         // documentation
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||     // benchmarking
    (a === 198 && b === 51 && c === 100) ||      // documentation
    (a === 203 && b === 0 && c === 113) ||       // documentation
    a >= 224                                     // multicast, reserved, broadcast
  );
}

/** Eight 16-bit groups, or null if this is not an IPv6 address. */
function parseV6(ip: string): number[] | null {
  let s = ip.replace(/%.*$/, '');                // zone id
  // A trailing dotted quad (::ffff:127.0.0.1) becomes two groups.
  const tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
  if (tail) {
    const v4 = parseV4(tail[1]);
    if (!v4) return null;
    s = s.slice(0, -tail[1].length) +
      ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * Whether an address must never be connected to.
 *
 * Fails closed: anything that does not parse is treated as private. The IPv6
 * cases that embed an IPv4 address (mapped, NAT64, 6to4, the old compatible
 * form) are judged by the address they embed, because `::ffff:169.254.169.254`
 * is the metadata endpoint wearing a disguise.
 */
export function isPrivateAddress(ip: string): boolean {
  const h = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const v4 = parseV4(h);
  if (v4) return v4Private(v4);

  const g = parseV6(h);
  if (!g) return true;

  const embedded = (hi: number, lo: number) => v4Private([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);

  if (zeros(8)) return true;                                        // ::
  if (zeros(7) && g[7] === 1) return true;                          // ::1
  if (zeros(5) && g[5] === 0xffff) return embedded(g[6], g[7]);     // ::ffff:a.b.c.d
  if (zeros(6)) return embedded(g[6], g[7]);                        // ::a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return embedded(g[6], g[7]);                                    // NAT64
  }
  if (g[0] === 0x2002) return embedded(g[1], g[2]);                 // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true;                      // unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true;                      // link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                      // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;              // documentation
  if (g[0] === 0x0100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // discard
  return false;
}

/** A recognised Canvas host. Kept for callers that ask exactly that question. */
export function isCanvasHost(host: string): boolean {
  return identifySource(host)?.kind === 'canvas';
}

export type FeedUrlResult =
  | { ok: true; url: URL }
  | { ok: false; error: string; hint?: string };

export function validateFeedUrl(raw: unknown): FeedUrlResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Paste a calendar link.', hint: 'It usually ends in .ics, or starts with webcal://.' };
  }

  // Calendar apps hand out webcal:// and http:// variants of the same link.
  const normalised = raw.trim().replace(/^webcals?:/i, 'https:').replace(/^http:/i, 'https:');

  let url: URL;
  try {
    url = new URL(normalised);
  } catch {
    return { ok: false, error: "That doesn't look like a link." };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Only web links are accepted: https or webcal.' };
  }

  if (url.username || url.password) {
    // A link carrying a password is a login, not a feed, and Heron does not
    // take logins for anything.
    return { ok: false, error: 'That link has a username or password in it, which Heron never accepts.' };
  }

  if (url.port && url.port !== '443') {
    // Every real calendar feed is served on the default port. Allowing others
    // turns this route into a way to knock on arbitrary services.
    return { ok: false, error: 'That link uses an unusual port, so it was not fetched.' };
  }

  if (isForbiddenHost(url.hostname)) {
    return {
      ok: false,
      error: "That link points at a private address, so it can't be fetched.",
      hint: 'Calendar links come from a public site: your school, Google, iCloud, Outlook, or your work scheduling app.',
    };
  }

  return { ok: true, url };
}

/**
 * Safe to log or show in an error report: keeps the host and drops the token.
 * The path segment of a feed URL *is* the credential.
 */
export function redactFeedUrl(url: URL): string {
  return `${url.origin}/…`;
}
