/**
 * Making up a skipped session of a weekly goal.
 *
 * Coursework has a deadline, so a skip just books the work again before it.
 * A goal has no deadline, only a count, so "find another time" has no anchor
 * and a skip would quietly shrink the week. Brydon asked for two concrete
 * offers instead: fold the time into the goal's next session, or, when
 * tomorrow has no session of it, do it tomorrow.
 *
 * Both are deterministic and touch only the one block they create or extend.
 * Each is offered only when it fits in free time, so accepting never lands on
 * a class, an event or another block.
 */

import type { Availability, FixedEvent, StudyBlock } from '../types.ts';
import { addDays, fmtDay, localParts, zonedInstant } from '../time.ts';
import { freeSlots } from './slots.ts';

export type MakeUp =
  | { kind: 'extend'; targetId: string; start: string; end: string; minutes: number }
  | { kind: 'tomorrow'; start: string; end: string; minutes: number };

interface State {
  blocks: StudyBlock[];
  availability: Availability;
  events: FixedEvent[];
}

interface Span { start: number; end: number }

/** Everything already holding time, except the blocks named. */
function taken(state: State, except: Set<string>): Span[] {
  return [
    ...state.blocks
      .filter((b) => !except.has(b.id) && b.status === 'planned')
      .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
    ...state.events.map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })),
  ];
}

/** True when [start, end) sits inside one free slot and clear of everything taken. */
function fits(state: State, start: number, end: number, now: Date, tz: string, except: Set<string>): boolean {
  if (start < now.getTime()) return false;
  const slots = freeSlots(state.availability, now, 15, tz, 1);
  const inside = slots.some((s) => s.start.getTime() <= start && end <= s.end.getTime());
  if (!inside) return false;
  return !taken(state, except).some((t) => t.start < end && start < t.end);
}

const STEP_MS = 15 * 60_000;

/**
 * The offers for a skipped goal block, best first. Empty for coursework.
 *
 * Order follows the ask: when tomorrow already has a session of this goal the
 * natural move is adding to it; when it does not, tomorrow comes first.
 */
export function makeUpOptions(state: State, blockId: string, now: Date, tz: string): MakeUp[] {
  const skipped = state.blocks.find((b) => b.id === blockId);
  if (!skipped?.commitmentId) return [];
  const minutes = skipped.minutes;
  const ms = minutes * 60_000;
  const tomorrow = addDays(localParts(now, tz).dateKey, 1);

  const sameGoal = state.blocks
    .filter((b) => b.commitmentId === skipped.commitmentId && b.id !== blockId && b.status === 'planned'
      && Date.parse(b.start) > now.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));

  const out: MakeUp[] = [];

  // Add to the next session: after it if there is room, else before it.
  const next = sameGoal[0];
  if (next) {
    const s = Date.parse(next.start);
    const e = Date.parse(next.end);
    const except = new Set([blockId, next.id]);
    if (fits(state, s, e + ms, now, tz, except)) {
      out.push({ kind: 'extend', targetId: next.id, start: next.start, end: new Date(e + ms).toISOString(), minutes: next.minutes + minutes });
    } else if (fits(state, s - ms, e, now, tz, except)) {
      out.push({ kind: 'extend', targetId: next.id, start: new Date(s - ms).toISOString(), end: next.end, minutes: next.minutes + minutes });
    }
  }

  // Tomorrow, only when tomorrow has none of this goal. Same time of day as
  // the skipped one if it is free, since that is when the student meant to do
  // it; otherwise the first free quarter hour that holds it.
  const tomorrowHasOne = sameGoal.some((b) => localParts(new Date(b.start), tz).dateKey === tomorrow);
  if (!tomorrowHasOne) {
    const except = new Set([blockId]);
    const p = localParts(new Date(skipped.start), tz);
    const slots = freeSlots(state.availability, now, 3, tz, minutes).filter((sl) => sl.dateKey === tomorrow);
    const candidates = [zonedInstant(tomorrow, p.minutesOfDay, tz).getTime()];
    for (const sl of slots) {
      for (let t = sl.start.getTime(); t + ms <= sl.end.getTime(); t += STEP_MS) candidates.push(t);
    }
    const start = candidates.find((t) => localParts(new Date(t), tz).dateKey === tomorrow && fits(state, t, t + ms, now, tz, except));
    if (start !== undefined) {
      out.push({ kind: 'tomorrow', start: new Date(start).toISOString(), end: new Date(start + ms).toISOString(), minutes });
    }
  }

  return tomorrowHasOne ? out : [...out.filter((o) => o.kind === 'tomorrow'), ...out.filter((o) => o.kind === 'extend')];
}

/**
 * Apply one offer. The changed block is pinned so a replan keeps it, and its
 * reason says where the extra time came from.
 */
export function applyMakeUp(blocks: StudyBlock[], skippedId: string, offer: MakeUp, tz: string): StudyBlock[] {
  const skipped = blocks.find((b) => b.id === skippedId);
  if (!skipped) return blocks;
  const from = `Makes up the session you skipped ${fmtDay(skipped.start, tz).split(',')[0]}.`;

  if (offer.kind === 'extend') {
    return blocks.map((b) => b.id === offer.targetId
      ? { ...b, start: offer.start, end: offer.end, minutes: offer.minutes, pinned: true, why: `${b.why} ${from}` }
      : b);
  }
  const made: StudyBlock = {
    ...skipped,
    id: `${skipped.id}-makeup`,
    start: offer.start,
    end: offer.end,
    minutes: offer.minutes,
    status: 'planned',
    actualMinutes: null,
    pinned: true,
    why: from,
  };
  return [...blocks.filter((b) => b.id !== made.id), made].sort((a, b) => a.start.localeCompare(b.start));
}
