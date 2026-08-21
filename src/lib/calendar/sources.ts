/**
 * Where an imported calendar came from.
 *
 * The allowlist widens from "Canvas only" to every calendar a student actually
 * uses, but it stays an allowlist. That is the whole SSRF defence for a route
 * that fetches a user-supplied URL server-side, so it never becomes "anything
 * that looks like a URL".
 *
 * Every host here is matched on its *suffix*. Matching a substring anywhere
 * accepted `calendar.google.com.attacker.com` once already; the fix generalises
 * rather than being repeated per provider.
 */

export type SourceKind = 'canvas' | 'google' | 'apple' | 'outlook' | 'other';

interface Provider {
  kind: SourceKind;
  label: string;
  /** Hostname suffixes, matched with a leading-dot or exact-match rule. */
  hosts: string[];
  /** What the events mean once imported. */
  produces: 'assignments' | 'events';
}

const PROVIDERS: Provider[] = [
  {
    kind: 'canvas',
    label: 'Canvas',
    hosts: ['instructure.com'],
    produces: 'assignments',
  },
  {
    kind: 'google',
    label: 'Google Calendar',
    hosts: ['calendar.google.com', 'www.google.com', 'google.com'],
    produces: 'events',
  },
  {
    kind: 'apple',
    label: 'Apple Calendar',
    hosts: ['icloud.com', 'me.com', 'calendars.icloud.com', 'p01-calendars.icloud.com'],
    produces: 'events',
  },
  {
    kind: 'outlook',
    label: 'Outlook',
    hosts: ['outlook.office365.com', 'outlook.live.com', 'outlook.com', 'office.com', 'sharepoint.com'],
    produces: 'events',
  },
];

/** Suffix match: exact host, or a subdomain of it. Never a substring. */
function matchesHost(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Self-hosted Canvas: canvas.<school>.edu and the like. */
function isSelfHostedCanvas(host: string): boolean {
  return host.endsWith('.edu') && (host.startsWith('canvas.') || host.includes('.canvas.'));
}

export interface Source {
  kind: SourceKind;
  label: string;
  produces: 'assignments' | 'events';
}

export function identifySource(hostname: string): Source | null {
  const host = hostname.toLowerCase();

  for (const p of PROVIDERS) {
    if (p.hosts.some((h) => matchesHost(host, h))) {
      return { kind: p.kind, label: p.label, produces: p.produces };
    }
  }

  if (isSelfHostedCanvas(host)) {
    return { kind: 'canvas', label: 'Canvas', produces: 'assignments' };
  }

  return null;
}

/** Everything a student might paste, for the UI to explain. */
export const SOURCE_HELP: Array<{ kind: SourceKind; label: string; where: string }> = [
  {
    kind: 'canvas',
    label: 'Canvas',
    where: 'Calendar → Calendar Feed, in the right-hand sidebar',
  },
  {
    kind: 'google',
    label: 'Google Calendar',
    where: 'Settings → pick a calendar → Secret address in iCal format',
  },
  {
    kind: 'apple',
    label: 'Apple Calendar',
    where: 'Right-click a calendar → Share Calendar → Public Calendar → copy the link',
  },
  {
    kind: 'outlook',
    label: 'Outlook',
    where: 'Settings → Calendar → Shared calendars → Publish a calendar → ICS',
  },
];
