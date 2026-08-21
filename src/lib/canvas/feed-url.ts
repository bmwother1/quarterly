/**
 * Validation for a student-supplied Canvas feed URL.
 *
 * Lives apart from the route handler so it can be tested directly. This is the
 * only thing standing between "fetch a URL server-side on request" and a
 * server-side request forgery hole, and untested security logic is decoration.
 */

import { identifySource } from '../calendar/sources.ts';

/** Private, loopback, and link-local space. Never fetchable from a public route. */
export function isForbiddenHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('fe80:') ||
    h.startsWith('fc') ||
    h.startsWith('fd') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith('.internal') ||
    h.endsWith('.local')
  );
}

/**
 * A recognised calendar host: Canvas, Google, Apple or Outlook.
 *
 * Every rule is anchored to the *end* of the hostname, which is the only part
 * an attacker can't control. Matching a provider name anywhere in the host
 * looks equivalent and is not — `canvas.uw.edu.attacker.com` contains "canvas."
 * and is a domain anyone can register. That bug happened once; suffix matching
 * is the fix, and it now lives in one place for every provider.
 */
export function isCanvasHost(host: string): boolean {
  return identifySource(host) !== null;
}

export type FeedUrlResult =
  | { ok: true; url: URL }
  | { ok: false; error: string; hint?: string };

export function validateFeedUrl(raw: unknown): FeedUrlResult {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, error: 'Paste your Canvas calendar feed URL.' };
  }

  // Canvas hands out webcal:// and http:// variants of the same link.
  const normalised = raw.trim().replace(/^webcal:/i, 'https:').replace(/^http:/i, 'https:');

  let url: URL;
  try {
    url = new URL(normalised);
  } catch {
    return { ok: false, error: "That doesn't look like a URL." };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Only https feed URLs are accepted.' };
  }

  if (isForbiddenHost(url.hostname) || !isCanvasHost(url.hostname)) {
    return {
      ok: false,
      error: "That isn't a calendar link we recognise.",
      hint: 'Canvas, Google Calendar, Apple Calendar and Outlook all work. Check you copied the iCal or ICS link, not the page address.',
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
