import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateFeedUrl, isCanvasHost, isForbiddenHost, redactFeedUrl } from '../src/lib/canvas/feed-url.ts';

const ok = (raw: string) => {
  const r = validateFeedUrl(raw);
  assert.ok(r.ok, `expected ${raw} to be accepted, got: ${r.ok ? '' : r.error}`);
  return r.url;
};
const rejected = (raw: unknown) => {
  const r = validateFeedUrl(raw);
  assert.ok(!r.ok, `expected rejection of ${String(raw)}`);
  return r;
};

describe('feed URL validation', () => {
  test('accepts a real UW Canvas feed', () => {
    const url = ok('https://canvas.uw.edu/feeds/calendars/user_abc123.ics');
    assert.equal(url.hostname, 'canvas.uw.edu');
  });

  test('accepts other institutions', () => {
    ok('https://canvas.instructure.com/feeds/calendars/user_x.ics');
    ok('https://uw.instructure.com/feeds/calendars/user_x.ics');
    ok('https://canvas.oregonstate.edu/feeds/calendars/user_x.ics');
  });

  test('upgrades the schemes Canvas actually hands out', () => {
    assert.equal(ok('webcal://canvas.uw.edu/feeds/calendars/u.ics').protocol, 'https:');
    assert.equal(ok('http://canvas.uw.edu/feeds/calendars/u.ics').protocol, 'https:');
  });

  test('refuses anything that is not a Canvas host', () => {
    // Without this the route is an open proxy anyone can point anywhere.
    rejected('https://example.com/evil.ics');
    rejected('https://canvas.uw.edu.attacker.com/u.ics');
    rejected('https://notcanvas.io/feeds/calendars/u.ics');
  });

  test('refuses loopback, private, and link-local space', () => {
    // The SSRF case: a public route that fetches user URLs can otherwise be
    // used to probe the network it runs inside, including cloud metadata.
    for (const host of [
      'localhost', '127.0.0.1', '0.0.0.0', '10.0.0.5', '192.168.1.1',
      '172.16.0.1', '172.31.255.255', '169.254.169.254', 'canvas.local', 'db.internal',
    ]) {
      assert.ok(isForbiddenHost(host), `${host} should be forbidden`);
      rejected(`https://${host}/feeds/calendars/u.ics`);
    }
  });

  test('169.254.169.254 is refused even dressed as Canvas', () => {
    // Cloud metadata endpoint. The forbidden check must win over the allowlist.
    rejected('https://canvas.169.254.169.254/u.ics');
  });

  test('refuses non-https schemes', () => {
    rejected('file:///etc/passwd');
    rejected('ftp://canvas.uw.edu/u.ics');
  });

  test('refuses junk input', () => {
    rejected('');
    rejected('   ');
    rejected(null);
    rejected(undefined);
    rejected(42);
    rejected('not a url at all');
  });

  test('every rejection explains itself', () => {
    for (const bad of ['https://example.com/x.ics', 'ftp://canvas.uw.edu/u.ics', '']) {
      const r = rejected(bad);
      assert.ok(!r.ok && r.error.length > 10, `weak error for ${bad}`);
    }
  });

  test('172.x boundaries are exact', () => {
    assert.ok(!isForbiddenHost('172.15.0.1'), '172.15 is public');
    assert.ok(isForbiddenHost('172.16.0.1'));
    assert.ok(isForbiddenHost('172.31.0.1'));
    assert.ok(!isForbiddenHost('172.32.0.1'), '172.32 is public');
  });

  test('host matcher is case-insensitive', () => {
    assert.ok(isCanvasHost('CANVAS.UW.EDU'));
    assert.ok(isForbiddenHost('LOCALHOST'));
  });

  test('redaction keeps the host and drops the token', () => {
    const url = ok('https://canvas.uw.edu/feeds/calendars/user_SECRETTOKEN.ics');
    const shown = redactFeedUrl(url);
    assert.ok(!shown.includes('SECRETTOKEN'), 'the token must never survive redaction');
    assert.ok(shown.includes('canvas.uw.edu'));
  });
});
