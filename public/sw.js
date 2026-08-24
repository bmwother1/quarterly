/**
 * Quarterly service worker.
 *
 * The app already keeps everything in localStorage, so the only reason it fails
 * without a signal is that the page itself can't load. This fixes that and
 * nothing more — no background sync, no push yet, no cleverness.
 *
 * One rule matters more than the rest: /api/feed is never cached. Its response
 * is derived from a Canvas feed URL, which is a bearer credential for a
 * student's entire schedule. A cached copy sitting in a shared browser is
 * exactly the leak the whole design avoids.
 */

const VERSION = 'v1';
const SHELL = `quarterly-shell-${VERSION}`;
const ASSETS = `quarterly-assets-${VERSION}`;

// Routes worth having available with no signal.
const ROUTES = ['/week', '/setup', '/settings', '/canvas', '/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(ROUTES))
      // A route failing to precache must not block activation; runtime caching
      // will pick it up on first visit instead.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith('quarterly-') && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything derived from a Canvas feed URL.
  if (url.pathname.startsWith('/api/')) return;

  // Build output is content-hashed, so a cache hit is always the right file.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(request, copy));
        return res;
      })),
    );
    return;
  }

  // Pages: fresh when there's a network, cached when there isn't. The other way
  // round would show a student yesterday's app for no reason.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        // Falls back to the root, which decides for itself. Falling back to
        // /week served the calendar to strangers whose first visit happened to
        // fail, which is the worst possible first impression of the app.
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('/'))),
    );
  }
});
