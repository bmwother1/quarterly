/**
 * What to send, and when to say nothing.
 *
 * Deciding *whether* to notify is most of the product judgment, so it lives
 * here as pure functions: no timers, no service worker, no network. Delivery is
 * a separate problem and a replaceable one.
 *
 * Four rules, enforced in code rather than left to whoever writes the copy:
 *
 *   1. Report, don't command. "Next up", never "Time to study".
 *   2. Always carry the reason. The block already has one; reuse it.
 *   3. Never imply failure. Falling behind is information, not a verdict.
 *   4. One a day. Frequency turns helpful into nagging faster than tone does.
 *
 * And one that shapes everything: a notification must be useful even if it's
 * never tapped. If it fully delivers the information, it helped. If it's bait
 * for a tap, people learn that and stop reading.
 */

import type { Assignment, Commitment, StudyBlock } from './types.ts';
import { fmtTime, localParts } from './time.ts';
import { durationBias } from './schedule/observed.ts';

export type NoticeKind = 'next-up' | 'recovery' | 'look-ahead' | 'duration-bias' | 'quota-strain';

export interface Notice {
  kind: NoticeKind;
  title: string;
  body: string;
  /** Where a tap should land. */
  href: string;
  /** Higher wins when two are eligible at once. */
  priority: number;
}

export interface NotifyInput {
  blocks: StudyBlock[];
  assignments: Assignment[];
  commitments: Commitment[];
  now: Date;
  tz: string;
  /** ISO instant of the last notification actually sent. Enforces one a day. */
  lastSentAt: string | null;
}

/** Minutes before a block starts to send the nudge. */
const LEAD_MINUTES = 15;

/**
 * The one notification worth sending right now, or null.
 *
 * Null is the common and correct answer. An app that always has something to
 * say is one people mute.
 */
export function nextNotice(input: NotifyInput): Notice | null {
  const candidates = [
    nextUp(input),
    recovery(input),
    lookAhead(input),
    durationNotice(input),
    quotaStrain(input),
  ].filter((n): n is Notice => n !== null);

  if (candidates.length === 0) return null;

  const best = candidates.sort((a, b) => b.priority - a.priority)[0];

  // The imminent nudge is time-critical and exempt from the daily cap; it is the
  // one message that is worthless if it arrives late. Everything else waits.
  if (best.kind !== 'next-up' && sentToday(input)) return null;

  return best;
}

function sentToday({ lastSentAt, now, tz }: NotifyInput): boolean {
  if (!lastSentAt) return false;
  return localParts(new Date(lastSentAt), tz).dateKey === localParts(now, tz).dateKey;
}

/** "Next up", 15 minutes before a block, carrying its own reason. */
function nextUp({ blocks, now }: NotifyInput): Notice | null {
  const soon = blocks
    .filter((b) => b.status === 'planned')
    .map((b) => ({ b, minutesAway: (new Date(b.start).getTime() - now.getTime()) / 60_000 }))
    .filter(({ minutesAway }) => minutesAway > 0 && minutesAway <= LEAD_MINUTES)
    .sort((x, y) => x.minutesAway - y.minutesAway)[0];

  if (!soon) return null;
  const { b } = soon;

  return {
    kind: 'next-up',
    title: `${b.course} in ${Math.max(1, Math.round(soon.minutesAway))} min · ${b.minutes} min`,
    body: b.why,
    href: '/week',
    priority: 100,
  };
}

/**
 * After blocks have slipped: lead with reassurance, state what still fits, and
 * name the one real casualty. Never a count of failures.
 */
function recovery({ blocks, now, tz }: NotifyInput): Notice | null {
  const missed = blocks.filter((b) => b.status === 'planned' && new Date(b.end) < now);
  if (missed.length < 2) return null;

  // Only worth saying once the day it happened is over.
  const hour = localParts(now, tz).hour;
  if (hour < 17) return null;

  const remaining = blocks.filter((b) => b.status === 'planned' && new Date(b.start) > now);
  const casualty = missed.find((b) => !remaining.some((r) => r.assignmentId === b.assignmentId && r.assignmentId));

  return {
    kind: 'recovery',
    title: `${missed.length} blocks slipped. Your week still works.`,
    body: casualty
      ? `Replan and the rest moves. ${casualty.course} is the one that gets tight.`
      : 'Replan and the rest moves around what you actually did.',
    priority: 70,
    href: '/week',
  };
}

/** Sunday: the week ahead as a sentence, before it starts rather than during. */
function lookAhead({ blocks, assignments, now, tz }: NotifyInput): Notice | null {
  const p = localParts(now, tz);
  if (p.weekday !== 6 || p.hour < 16 || p.hour > 20) return null;   // Sunday evening

  const weekAhead = blocks.filter((b) => {
    const t = new Date(b.start).getTime();
    return t > now.getTime() && t < now.getTime() + 7 * 86_400_000;
  });
  if (weekAhead.length === 0) return null;

  const hours = Math.round(weekAhead.reduce((s, b) => s + b.minutes, 0) / 60);
  const exam = assignments.find((a) => {
    const due = new Date(a.due).getTime();
    return a.kind === 'exam' && a.status === 'todo' &&
      due > now.getTime() && due < now.getTime() + 7 * 86_400_000;
  });

  // The heaviest day, named, because that's the one worth knowing about.
  const byDay = new Map<string, number>();
  for (const b of weekAhead) {
    const key = localParts(new Date(b.start), tz).dateKey;
    byDay.set(key, (byDay.get(key) ?? 0) + b.minutes);
  }
  const heaviest = [...byDay].sort((a, b) => b[1] - a[1])[0];
  const heaviestDay = heaviest
    ? new Date(heaviest[0] + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' })
    : null;

  return {
    kind: 'look-ahead',
    title: exam ? `Next week has your ${exam.course} ${exam.title} in it.` : 'Next week, roughly.',
    body: heaviestDay
      ? `About ${hours} hours planned. ${heaviestDay} is the tight day.`
      : `About ${hours} hours planned.`,
    priority: 60,
    href: '/week',
  };
}

/**
 * "This takes you longer than you plan." Stated as a fact about the work, and
 * paired with what the app did about it — never as a fact about the person.
 */
function durationNotice({ blocks, now, tz }: NotifyInput): Notice | null {
  const p = localParts(now, tz);
  if (p.hour < 18) return null;

  const worst = durationBias(blocks)[0];
  if (!worst || worst.ratio <= 1.4) return null;

  const plannedH = (worst.planned / worst.samples / 60).toFixed(1);
  const actualH = (worst.actual / worst.samples / 60).toFixed(1);

  return {
    kind: 'duration-bias',
    title: `${worst.course} takes you about ${actualH}h, not ${plannedH}h.`,
    body: 'Estimates updated, so next week’s plan has more room in it.',
    priority: 40,
    href: '/week',
  };
}

/**
 * A commitment that keeps falling short. Proposes shrinking the plan rather
 * than suggesting the student try harder — the plan is the thing that was wrong.
 */
function quotaStrain({ commitments, now, tz }: NotifyInput): Notice | null {
  const p = localParts(now, tz);
  if (p.weekday !== 6 || p.hour < 16) return null;   // Sunday, looking back

  const struggling = commitments
    .filter((c) => c.active && c.sessionsPerWeek > 1 && c.doneThisWeek <= c.sessionsPerWeek / 2)
    .sort((a, b) => (a.doneThisWeek / a.sessionsPerWeek) - (b.doneThisWeek / b.sessionsPerWeek))[0];

  if (!struggling) return null;

  return {
    kind: 'quota-strain',
    title: `${struggling.title}: ${struggling.doneThisWeek} of ${struggling.sessionsPerWeek} this week.`,
    body: `${struggling.sessionsPerWeek} a week might be more than there’s room for. Want to drop it to ${Math.max(1, struggling.sessionsPerWeek - 1)}?`,
    priority: 50,
    href: '/setup',
  };
}

/** Everything the copy must never do. Asserted in tests, not left to review. */
export const BANNED_PHRASES = [
  "don't forget", 'you should', 'you need to', 'you failed', 'you missed',
  'time to study', 'get to work', 'behind schedule', 'streak', 'you always',
  'why not', 'come on',
];

export function violatesTone(text: string): string | null {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.find((p) => lower.includes(p)) ?? null;
}

/** Human preview of the next notice. Used by the terminal preview and settings. */
export function describe(n: Notice): string {
  return `${n.title}\n${n.body}`;
}

export { fmtTime };
