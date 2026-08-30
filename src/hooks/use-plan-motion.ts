'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Blocks travel to their new slots when the plan changes, instead of teleporting.
 *
 * The welcome carousel has always animated a block leaving Tuesday and arriving
 * on Thursday, because that movement is the argument the whole product makes.
 * The real week never did: a replan swapped one set of positions for another
 * between frames, and a banner explained afterwards what had moved. The student
 * being *told* what changed is strictly worse than the student watching it,
 * and the people who saw the good version were the ones who had not signed up yet.
 *
 * ## Why FLIP rather than a CSS transition
 *
 * A block is rendered by its own day column, so moving to another day means
 * unmounting from one parent and mounting in another. There is no element whose
 * `left` could transition, which is the same structural fact that broke
 * cross-day dragging three times. So positions are measured before and after the
 * render, and the element is animated from where it *was* to where it now is.
 * Nothing about the layout has to change, which matters on a component with this
 * much history.
 *
 * ## Why it measures against the grid rather than the viewport
 *
 * `getBoundingClientRect` is viewport-relative, and the week scrolls sideways
 * without re-rendering. A snapshot taken before a scroll would produce a false
 * delta the size of the scroll. Every measurement is therefore relative to the
 * grid element, which scrolls together with the blocks, so the numbers hold
 * still under both scroll axes.
 *
 * ## Why it cannot simply match blocks by id
 *
 * A block id is `${assignmentOrCommitmentId}@${startInstant}`, on purpose: session
 * indexes restart on every replan, so a finished session 1 and a freshly planned
 * session 1 once shared an id and React dropped blocks. The consequence for this
 * hook is that **a block that moves does not keep its id.** Matching on the whole
 * id therefore sees a deletion and an insertion, never a move, and animates
 * nothing at all. That was the first version, and it looked like working code.
 *
 * So blocks are matched on the part before the `@`, which is stable, and paired
 * within that group in start order: the second CHEM session before a replan is
 * the second CHEM session after it. When a replan produces fewer sessions than
 * it did last time, the surplus is simply unmatched and does not animate.
 */

/** Long enough to follow, shorter than the carousel's 720ms. See below. */
const DURATION = 560;

/**
 * The carousel is a demo nobody asked for, so it can afford 720ms to make one
 * block's journey unmissable. Here the student pressed replan and is waiting to
 * use the result, and there may be twenty blocks rather than one. Slightly
 * quicker, with a stagger so the eye gets a sequence instead of a stampede.
 */
const STAGGER = 24;
const MAX_STAGGER = 160;

/** The carousel's easing. The settle at the end reads as being placed. */
const EASE = 'cubic-bezier(0.34, 1.32, 0.5, 1)';

/** Below this, a "move" is a rounding artifact rather than a replan. */
const MIN_DELTA_PX = 1;

interface Placed {
  x: number;
  y: number;
  start: string;
}

/**
 * The stable half of a block id: everything before the start instant.
 *
 * `lastIndexOf` rather than `split`, because only the trailing `@` is the
 * separator and an upstream id is not guaranteed to be free of them.
 */
function sourceKey(id: string): string {
  const at = id.lastIndexOf('@');
  return at === -1 ? id : id.slice(0, at);
}

export function usePlanMotion(grid: RefObject<HTMLElement | null>, enabled = true) {
  const previous = useRef<Map<string, Placed[]>>(new Map());

  // Deliberately runs after every render rather than on a dependency list: the
  // snapshot has to stay current, or the first replan after any other update
  // animates from a stale position.
  useLayoutEffect(() => {
    const root = grid.current;
    if (!root) return;

    const origin = root.getBoundingClientRect();
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-block-id]'));

    // Everything on screen now, grouped by source and ordered by start, which is
    // the order the pairing below depends on.
    const current = new Map<string, Placed[]>();
    const nodesByKey = new Map<string, Array<{ node: HTMLElement; at: Placed }>>();

    for (const node of nodes) {
      const id = node.dataset.blockId;
      if (!id) continue;
      const start = node.dataset.blockStart ?? '';
      const box = node.getBoundingClientRect();
      const at: Placed = { x: box.left - origin.left, y: box.top - origin.top, start };

      const key = sourceKey(id);
      const list = nodesByKey.get(key);
      if (list) list.push({ node, at });
      else nodesByKey.set(key, [{ node, at }]);
    }

    for (const [key, list] of nodesByKey) {
      list.sort((a, b) => a.at.start.localeCompare(b.at.start));
      current.set(key, list.map((entry) => entry.at));
    }

    const moved: Array<{ node: HTMLElement; dx: number; dy: number }> = [];

    for (const [key, list] of nodesByKey) {
      const before = previous.current.get(key);
      // Nothing from this source last render, so it is new to the week. It
      // should appear, not fly in from a position it never occupied.
      if (!before) continue;

      list.forEach((entry, i) => {
        const was = before[i];
        if (!was) return;
        if (was.start === entry.at.start) return;

        const dx = was.x - entry.at.x;
        const dy = was.y - entry.at.y;
        if (Math.abs(dx) < MIN_DELTA_PX && Math.abs(dy) < MIN_DELTA_PX) return;

        moved.push({ node: entry.node, dx, dy });
      });
    }

    previous.current = current;

    if (!enabled || moved.length === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Top-to-bottom, so a week rebuilding itself reads down the day the way a
    // student reads it, rather than in whatever order the DOM happened to be in.
    moved.sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top);

    moved.forEach(({ node, dx, dy }, i) => {
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        {
          duration: DURATION,
          easing: EASE,
          delay: Math.min(i * STAGGER, MAX_STAGGER),
          // `backwards` holds the old position through the stagger delay.
          // Without it a block sits at its destination and then jumps back to
          // start moving, which is worse than no animation at all.
          fill: 'backwards',
        },
      );
    });
  });
}
