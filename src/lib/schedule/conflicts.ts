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
