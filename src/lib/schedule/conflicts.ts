/**
 * Resolving a collision between a fixed event and planned work.
 *
 * When a one-off lands on top of something already scheduled, the event wins.
 * That isn't a preference — an appointment has a real time in the world and a
 * study block does not, so the block is the only one of the two that *can*
 * move.
 *
 * The exception worth being careful about is a block the student dragged there
 * by hand. It's pinned precisely so the scheduler stops arguing with it, and
 * overriding that silently would undo the one place the app promised to defer.
 * So a pinned block does move — an appointment beats a preference — but it's
 * reported by name rather than quietly relocated.
 */

import type { FixedEvent, StudyBlock } from '../types.ts';

export interface Collision {
  block: StudyBlock;
  event: FixedEvent;
  /** Hand-placed blocks are worth telling the student about. */
  wasPinned: boolean;
}

export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return new Date(a.start) < new Date(b.end) && new Date(a.end) > new Date(b.start);
}

/**
 * Blocks that a set of events lands on top of.
 *
 * Settled blocks are excluded. A block already marked done is a record of what
 * happened, not a plan, and moving history to make room for a new appointment
 * would be rewriting the past to tidy the present.
 */
export function collisionsWith(blocks: StudyBlock[], events: FixedEvent[]): Collision[] {
  const out: Collision[] = [];
  for (const event of events) {
    for (const block of blocks) {
      if (block.status !== 'planned') continue;
      if (!overlaps(block, event)) continue;
      out.push({ block, event, wasPinned: block.pinned === true });
    }
  }
  return out;
}

/**
 * Clear the pin on anything an event now sits on, so the next plan is free to
 * move it. Everything else is left exactly as it was.
 */
export function releaseForEvents(blocks: StudyBlock[], events: FixedEvent[]): StudyBlock[] {
  const clashing = new Set(collisionsWith(blocks, events).map((c) => c.block.id));
  if (clashing.size === 0) return blocks;
  return blocks.map((b) => (clashing.has(b.id) ? { ...b, pinned: false } : b));
}

/** One sentence naming what had to move, or null when nothing did. */
export function describeCollisions(collisions: Collision[]): string | null {
  if (collisions.length === 0) return null;

  const moved = [...new Set(collisions.map((c) => c.block.course))];
  const event = collisions[0].event.title;
  const anyPinned = collisions.some((c) => c.wasPinned);

  const what = moved.length === 1
    ? moved[0]
    : `${moved.slice(0, -1).join(', ')} and ${moved[moved.length - 1]}`;

  return anyPinned
    ? `Moved ${what} — you'd placed it where ${event} is`
    : `Moved ${what} around ${event}`;
}

/**
 * Nudge planned blocks out from under one the student just moved by hand.
 *
 * **Why blocks push each other at all.** A calendar where two things sit on top
 * of each other at 3pm is lying about the same thing the "didn't fit" list
 * exists to be honest about. If a student drags a run onto their essay hour,
 * one of them has to give, and pretending both happen is the worst answer.
 *
 * **Why the dragged one wins.** It is the only thing on screen the student has
 * just made an explicit decision about. Everything else is the scheduler's
 * opinion, and an opinion yields to an instruction. This is the same reasoning
 * as an appointment beating a plan, one level down.
 *
 * **What never moves.** Settled blocks, for the reason `collisionsWith` gives:
 * a block marked done is a record of what happened, and shifting it to tidy the
 * present would be rewriting the past. A settled block therefore blocks the
 * space rather than yielding it, and a displaced block goes around it.
 *
 * Displacement is downward only, into the next free gap after the obstruction.
 * Pushing earlier would move work into hours that have already passed, which is
 * the one direction that can silently make a block impossible.
 */
export function pushAside(
  blocks: StudyBlock[],
  movedId: string,
  opts: { dayEndMin?: number } = {},
): { blocks: StudyBlock[]; displaced: StudyBlock[] } {
  const moved = blocks.find((b) => b.id === movedId);
  if (!moved) return { blocks, displaced: [] };

  const dayEnd = opts.dayEndMin ?? 24 * 60;
  const displaced: StudyBlock[] = [];

  // Anything that could be in the way, earliest first, so a chain of pushes
  // resolves in one pass rather than leapfrogging.
  const others = blocks
    .filter((b) => b.id !== movedId && b.status === 'planned')
    .sort((a, b) => a.start.localeCompare(b.start));

  // Immovable: the block the student placed, plus everything settled.
  const fixed: Array<{ start: string; end: string }> = [
    { start: moved.start, end: moved.end },
    ...blocks.filter((b) => b.id !== movedId && b.status !== 'planned'),
  ];

  const placed = new Map<string, StudyBlock>();

  for (const b of others) {
    let candidate = b;

    // Walk forward past anything it now overlaps, including blocks already
    // pushed on this pass, or two displaced blocks land on each other.
    for (let guard = 0; guard < 20; guard++) {
      const obstruction = [...fixed, ...placed.values()].find(
        (f) => 'start' in f && overlaps(candidate, f),
      );
      if (!obstruction) break;

      const shiftedStart = new Date(obstruction.end);
      const shiftedEnd = new Date(shiftedStart.getTime() + candidate.minutes * 60_000);
      candidate = {
        ...candidate,
        start: shiftedStart.toISOString(),
        end: shiftedEnd.toISOString(),
      };
    }

    if (candidate.start !== b.start) {
      // Past the end of the usable day it is not a move any more, it is a
      // block at 2am. Left where it was and reported instead: an honest
      // overlap the student can see beats a silent impossibility.
      const endMinute = new Date(candidate.end).getHours() * 60 + new Date(candidate.end).getMinutes();
      const wrapped = new Date(candidate.start).toDateString() !== new Date(b.start).toDateString();
      if (wrapped || endMinute > dayEnd) {
        continue;
      }
      displaced.push(candidate);
    }
    placed.set(candidate.id, candidate);
  }

  if (displaced.length === 0) return { blocks, displaced: [] };

  const byId = new Map(displaced.map((b) => [b.id, b]));
  return {
    blocks: blocks
      .map((b) => byId.get(b.id) ?? b)
      .sort((a, b) => a.start.localeCompare(b.start)),
    displaced,
  };
}

/** "Moved Run and Reading down." Said out loud, because silent shuffling is how a plan becomes fiction. */
export function describeDisplaced(displaced: StudyBlock[]): string | null {
  if (displaced.length === 0) return null;
  const names = [...new Set(displaced.map((b) => b.course))];
  if (names.length === 1) return `Moved ${names[0]} to make room.`;
  if (names.length === 2) return `Moved ${names[0]} and ${names[1]} to make room.`;
  return `Moved ${names.length} blocks to make room.`;
}
