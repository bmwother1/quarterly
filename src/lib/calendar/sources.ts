/**
 * Where an imported calendar came from, and what that makes its contents mean.
 *
 * This used to be the SSRF allowlist as well. It no longer is: which addresses
 * may be fetched is decided on the address itself (`feed-url.ts` and
 * `fetch-feed.ts`). What remains here is meaning. Canvas carries deadlines to
 * plan toward; everything else carries time already spoken for; and a work
 * scheduling app's events are shifts, whatever the manager called them.
 *
 * Every host is still matched on its *suffix*. Matching a substring anywhere
 * accepted `calendar.google.com.attacker.com` once. It can no longer fetch
 * anything it could not fetch anyway, but a lookalike being *labelled* Canvas
 * would turn a stranger's calendar into assignments, so the rule stays.
 */

import type { Category } from '../categories.ts';

export type SourceKind = 'canvas' | 'google' | 'apple' | 'outlook' | 'work' | 'other';

interface Provider {
  kind: SourceKind;
  label: string;
  /** Hostname suffixes, matched with a leading-dot or exact-match rule. */
  hosts: string[];
  /** What the events mean once imported. */
  produces: 'assignments' | 'events';
  /** Forces a category on every imported event, when the source says what they are. */
  category?: Category;
}

const PROVIDERS: Provider[] = [
  { kind: 'canvas', label: 'Canvas', hosts: ['instructure.com'], produces: 'assignments' },
  {
    kind: 'google',
    label: 'Google Calendar',
    hosts: ['calendar.google.com', 'www.google.com', 'google.com'],
    produces: 'events',
  },
  {
    kind: 'apple',
    label: 'Apple Calendar',
    hosts: ['icloud.com', 'me.com'],
    produces: 'events',
  },
  {
    kind: 'outlook',
    label: 'Outlook',
    hosts: ['outlook.office365.com', 'outlook.live.com', 'outlook.com', 'office.com', 'sharepoint.com'],
    produces: 'events',
  },
  /*
   * Work scheduling apps. Each of these publishes a personal iCal link for an
   * employee's own shifts, usually from its web app rather than its phone app.
   * Listed for their label and so their events file as work; any other app's
   * link is still fetched, it just reads as "a calendar from <site>".
   */
  { kind: 'work', label: 'When I Work', hosts: ['wheniwork.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: '7shifts', hosts: ['7shifts.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Homebase', hosts: ['joinhomebase.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Sling', hosts: ['getsling.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Deputy', hosts: ['deputy.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'UKG', hosts: ['mykronos.com', 'ukg.net', 'ultipro.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Humanity', hosts: ['humanity.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'HotSchedules', hosts: ['hotschedules.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'ZoomShift', hosts: ['zoomshift.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Findmyshift', hosts: ['findmyshift.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Connecteam', hosts: ['connecteam.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Planday', hosts: ['planday.com'], produces: 'events', category: 'work' },
  { kind: 'work', label: 'Shiftboard', hosts: ['shiftboard.com'], produces: 'events', category: 'work' },
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
  category?: Category;
}

export function identifySource(hostname: string): Source | null {
  const host = hostname.toLowerCase().replace(/\.$/, '');

  for (const p of PROVIDERS) {
    if (p.hosts.some((h) => matchesHost(host, h))) {
      return { kind: p.kind, label: p.label, produces: p.produces, category: p.category };
    }
  }

  if (isSelfHostedCanvas(host)) {
    return { kind: 'canvas', label: 'Canvas', produces: 'assignments' };
  }

  return null;
}

/**
 * Canvas, recognised by what it says about itself.
 *
 * Plenty of schools run Canvas on a domain matching neither rule above
 * (`bcourses.berkeley.edu`, `learn.<school>.edu`). Every Canvas feed announces
 * itself in its PRODID, which Canvas sets and nothing else would, so this is a
 * signature rather than a guess about the contents.
 */
export function isCanvasFeed(raw: string): boolean {
  return /^PRODID:.*instructure/im.test(raw.slice(0, 2000));
}

/**
 * What to call a source, recognised or not.
 *
 * An unrecognised link still imports; it is just named after the site, so the
 * student can tell their work calendar from their club's.
 */
export function describeSource(hostname: string, raw?: string): Source {
  const known = identifySource(hostname);
  if (known) return known;
  if (raw && isCanvasFeed(raw)) return { kind: 'canvas', label: 'Canvas', produces: 'assignments' };
  const site = hostname.toLowerCase().replace(/^www\./, '');
  return { kind: 'other', label: `Calendar from ${site}`, produces: 'events' };
}

/** Everything a student might paste, for the UI to explain. */
export const SOURCE_HELP: Array<{ kind: SourceKind; label: string; where: string; note?: string }> = [
  {
    kind: 'canvas',
    label: 'Canvas',
    where: 'On an iPhone: open Canvas in Safari, not the Canvas app, and go to Calendar. Tap aA in the address bar, then Request Desktop Website. Tap Calendar Feed at the bottom of the right-hand column, then press and hold the link it shows and tap Copy. On a laptop: Calendar, then Calendar Feed in the right-hand column. Signed in, a link you save on one device is on your others too, so pasting it once on a laptop also sets up your phone.',
    note: 'Already subscribed in your iPhone calendar? The link is in Settings, Apps, Calendar, Calendar Accounts, Subscribed Calendars (on iOS 17 or earlier, Settings, Calendar, Accounts), in the Server field of the Canvas one. If Canvas is not listed there, your iPhone saved it to iCloud or copied the events in once, and there is no link to copy; use Safari as above.',
  },
  {
    kind: 'google',
    label: 'Google Calendar',
    where: 'On the web, not the app: Settings, pick the calendar, then Secret address in iCal format.',
    note: 'School Google accounts sometimes have this switched off by the school. A personal Gmail calendar always has it.',
  },
  {
    kind: 'apple',
    label: 'Apple Calendar',
    where: 'On an iPhone: Calendar, Calendars, tap the i next to one, turn on Public Calendar, then Share Link. Or on a Mac, File then Export, and choose the file below.',
    note: 'A public link can be opened by anyone who has it. The exported file exposes nothing.',
  },
  {
    kind: 'outlook',
    label: 'Outlook',
    where: 'Outlook on the web: Settings, Calendar, Shared calendars, Publish a calendar, then copy the ICS link.',
    note: 'School accounts sometimes have publishing switched off. If the option is missing, that is why.',
  },
  {
    kind: 'work',
    label: 'Work schedule',
    where: 'When I Work, 7shifts, Homebase, Sling, Deputy, UKG and most other scheduling apps have a calendar sync or subscribe option, usually in the web version. Copy the link it gives you, the one ending in .ics or starting with webcal.',
    note: 'If your app only offers to add shifts to your phone calendar, do that, then import that calendar from Google or Apple above. If it has no calendar option at all (TimeTree is one), add your usual shifts once in Setup as work hours.',
  },
];
