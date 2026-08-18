/**
 * Validation for a student-supplied Canvas feed URL.
 *
 * Lives apart from the route handler so it can be tested directly. This is the
 * only thing standing between "fetch a URL server-side on request" and a
 * server-side request forgery hole, and untested security logic is decoration.
 */

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
 * Canvas is hosted per-institution: canvas.uw.edu, <school>.instructure.com,
 * canvas.<school>.edu. An allowlist keeps this from becoming a general-purpose
 * URL fetcher that anyone can point anywhere.
 *
 * Both rules are anchored to the *end* of the hostname, which is the only part
 * an attacker can't control. Matching "canvas." anywhere in the host looks
 * equivalent and is not: canvas.uw.edu.attacker.com contains it, and is a
 * domain someone can simply register. Suffix matching is the whole defence.
 */
export function isCanvasHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'instructure.com' || h.endsWith('.instructure.com')) return true;
  // Self-hosted Canvas at a university: must be a canvas.* subdomain of a .edu.
  return h.endsWith('.edu') && (h.startsWith('canvas.') || h.includes('.canvas.'));
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
      error: "That host isn't a Canvas server.",
      hint: 'The link should look like https://canvas.uw.edu/feeds/calendars/user_....ics',
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
