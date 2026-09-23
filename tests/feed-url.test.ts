import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateFeedUrl, isCanvasHost, isForbiddenHost, isPrivateAddress, redactFeedUrl } from '../src/lib/canvas/feed-url.ts';
import { identifySource, describeSource, isCanvasFeed } from '../src/lib/calendar/sources.ts';

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

  test('accepts any public calendar host, because work schedules live everywhere', () => {
    // The policy change of 2026-09-22. Refusing unknown hosts was standing in
    // for refusing private addresses, and it turned away every student whose
    // employer picked a scheduling app nobody listed.
    ok('https://app.wheniwork.com/ical/abc.ics');
    ok('webcal://acme.na.deputy.com/exec/ical/xyz');
    ok('https://calendar.some-club.org/feed.ics');
  });

  test('a lookalike host is fetched as nothing special, never as Canvas', () => {
    // What the old allowlist really protected: a stranger's calendar being
    // read as coursework. That now rests on identification alone.
    for (const host of ['canvas.uw.edu.attacker.com', 'notinstructure.com', 'instructure.com.evil.io']) {
      assert.equal(isCanvasHost(host), false, host);
      assert.equal(describeSource(host).produces, 'events', host);
    }
  });

  test('refuses links that carry a login or an odd port', () => {
    rejected('https://user:pass@calendar.google.com/x.ics');
    rejected('https://calendar.google.com:8443/x.ics');
    ok('https://calendar.google.com:443/x.ics');
  });

  test('refuses bare and local names', () => {
    for (const h of ['intranet', 'localhost.', 'printer.home.arpa', 'db.internal']) {
      rejected(`https://${h}/x.ics`);
    }
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
    for (const bad of ['https://10.0.0.1/x.ics', 'ftp://canvas.uw.edu/u.ics', '', 'https://a:b@x.com/c']) {
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

describe('private addresses, judged on the address', () => {
  test('the IPv4 ranges that matter', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255']) {
      assert.ok(isPrivateAddress(ip), ip);
    }
    for (const ip of ['8.8.8.8', '140.142.12.1', '172.32.0.1', '100.128.0.1']) {
      assert.ok(!isPrivateAddress(ip), ip);
    }
  });

  test('IPv6, including every form that smuggles an IPv4 address', () => {
    // ::ffff:169.254.169.254 is the cloud metadata endpoint in disguise, and
    // it is exactly what a rebinding attack answers with.
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1',
      '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '[::ffff:169.254.169.254]', '64:ff9b::a9fe:a9fe',
      '2002:a9fe:a9fe::1', '2001:db8::1', 'fe80::1%en0']) {
      assert.ok(isPrivateAddress(ip), ip);
    }
    for (const ip of ['2607:f8b0:4005:80a::200e', '2001:4860:4860::8888', '::ffff:8.8.8.8']) {
      assert.ok(!isPrivateAddress(ip), ip);
    }
  });

  test('anything unparseable is treated as private', () => {
    for (const junk of ['', 'not-an-ip', '1.2.3', '999.1.1.1', ':::1', '1::2::3']) {
      assert.ok(isPrivateAddress(junk), junk);
    }
  });

  test('numeric host tricks are normalised by the URL parser and still refused', () => {
    for (const trick of ['https://2130706433/x.ics', 'https://0x7f000001/x.ics', 'https://[::ffff:7f00:1]/x.ics']) {
      rejected(trick);
    }
  });
});

describe('what a source means', () => {
  test('work scheduling apps are labelled and their events are work', () => {
    for (const [host, label] of [['app.wheniwork.com', 'When I Work'], ['acme.na.deputy.com', 'Deputy'],
      ['app.7shifts.com', '7shifts'], ['app.joinhomebase.com', 'Homebase']]) {
      const s = identifySource(host)!;
      assert.equal(s.label, label);
      assert.equal(s.category, 'work');
      assert.equal(s.produces, 'events');
    }
  });

  test('an unknown site is named after itself', () => {
    assert.equal(describeSource('www.someclub.org').label, 'Calendar from someclub.org');
  });

  test('Canvas on a domain no rule knows is recognised by its own signature', () => {
    const feed = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Instructure//Canvas//EN\r\nEND:VCALENDAR';
    assert.ok(isCanvasFeed(feed));
    assert.equal(describeSource('bcourses.berkeley.edu', feed).produces, 'assignments');
    assert.equal(describeSource('bcourses.berkeley.edu', 'BEGIN:VCALENDAR\r\nPRODID:-//Google Inc//EN').produces, 'events');
  });
});
