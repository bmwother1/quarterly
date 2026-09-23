/**
 * Folding a fresh Canvas fetch into the assignments a student already has.
 *
 * Importing used to be `assignments: result.assignments`, a straight replace.
 * That is survivable when importing happens once, and quietly destructive the
 * moment it happens weekly: it throws away every "done", every minute actually
 * spent, and every task the student typed by hand, then hands the scheduler a
 * pile of work it has already watched them finish.
 *
 * The rule that resolves every field is one sentence: **Canvas owns what the
 * feed says, the student owns what using the app produced.**
 *
 *   Canvas owns:  title, course, courseFull, kind, due, allDay, url, weight.
 *                 All of it is derived from the feed's own text, so the newest
 *                 fetch is by definition the better answer.
 *   Student owns: status, actualMinutes, confidence, lastTouched, and the
 *                 corrected estimate. None of it exists in Canvas and none of
 *                 it is recoverable once dropped.
 *
 * The one exception is `estimatedMinutes` on work that has never been touched:
 * there is nothing learned to protect, so a re-classified title gets its new
 * seed rather than keeping a guess made from the old one.
 */

import type { Assignment, Course } from '../types.ts';
import type { HeronState } from '../store.ts';
import { coursesFrom } from './interpret.ts';

/**
 * Work the student typed, which no feed owns.
 *
 * `addTask` mints `t-…`, the same way an imported event is `imp-…`. Everything
 * else in `assignments` came from a Canvas UID, so the prefix is the only thing
 * that has to be checked, and a hand-added task disappearing because Canvas
 * never heard of it is precisely the bug this guards.
 */
const HAND_ADDED = /^t-/;

export interface MergeResult {
  assignments: Assignment[];
  courses: Course[];
  /** In the feed, not held before. */
  added: number;
  /** Held before, and Canvas has changed something about it. */
  updated: number;
  /** The new ones, so a daily refresh can fit exactly these into the week. */
  addedIds: string[];
  /** Held before with a different deadline. Their sessions may now sit past it. */
  movedIds: string[];
  /** Held before, gone from the feed, and never worked on. */
  removed: number;
  /**
   * The ids that went. Blocks pointing at them have to go in the same update
   * or the week renders sessions for work that no longer exists.
   */
  removedIds: string[];
  /** Gone from the feed after the student had started it: kept, and no longer planned. */
  retired: number;
  /** Their planned sessions go; their finished and skipped ones stay as history. */
  retiredIds: string[];
}

/** Has Canvas changed anything it owns? */
function canvasChanged(held: Assignment, next: Assignment): boolean {
  return held.title !== next.title
    || held.courseFull !== next.courseFull
    || held.kind !== next.kind
    || held.due !== next.due
    || held.allDay !== next.allDay
    || held.url !== next.url;
}

/** Nothing the student did has been recorded against this yet. */
function untouched(a: Assignment): boolean {
  return a.status === 'todo' && a.actualMinutes === 0 && a.lastTouched === null;
}

export function mergeCanvasImport(
  prev: { assignments: Assignment[]; courses: Course[] },
  incoming: Assignment[],
): MergeResult {
  const held = new Map(prev.assignments.map((a) => [a.id, a]));
  const inFeed = new Set(incoming.map((a) => a.id));

  let updated = 0;
  const addedIds: string[] = [];
  const movedIds: string[] = [];

  const fromFeed = incoming.map((next) => {
    const mine = held.get(next.id);
    if (!mine) {
      addedIds.push(next.id);
      return next;
    }
    if (canvasChanged(mine, next)) updated += 1;
    if (mine.due !== next.due) movedIds.push(next.id);
    return {
      ...next,
      estimatedMinutes: untouched(mine) ? next.estimatedMinutes : mine.estimatedMinutes,
      actualMinutes: mine.actualMinutes,
      status: mine.status,
      confidence: mine.confidence,
      lastTouched: mine.lastTouched,
    };
  });

  /**
   * What to do with something the feed no longer mentions.
   *
   * An instructor deleting or unpublishing an assignment is the common case, and
   * leaving it behind means a student is planned against a deadline that stopped
   * existing weeks ago. Three answers, by what the student has done with it:
   *
   *   hand-added        → untouched. Canvas never owned it.
   *   never worked on   → removed. Nothing is lost.
   *   worked on         → kept, and stops being planned. The minutes are the
   *                       only record of that work anywhere, so they stay; but
   *                       leaving it `todo` would have the planner booking
   *                       sessions for homework that no longer exists, forever.
   *                       `dropped` is what "drop it" already means, so this
   *                       is the student's own verb, applied on Canvas's say-so.
   *
   * `refresh-week.ts` is what found the third case: the first version of this
   * kept the record and left it `todo`, and every check passed.
   */
  const kept: Assignment[] = [];
  const removedIds: string[] = [];
  const retiredIds: string[] = [];

  for (const a of prev.assignments) {
    if (inFeed.has(a.id)) continue;
    if (HAND_ADDED.test(a.id)) {
      kept.push(a);
    } else if (untouched(a)) {
      removedIds.push(a.id);
    } else if (a.status === 'todo') {
      kept.push({ ...a, status: 'dropped' });
      retiredIds.push(a.id);
    } else {
      kept.push(a);
    }
  }

  const assignments = [...fromFeed, ...kept].sort((x, y) => x.due.localeCompare(y.due));

  // Courses come from feed-owned work only, so a hand-added task filed under
  // "Personal" never invents a course. The kept ones are included so a finished
  // assignment whose course has ended keeps its colour rather than falling back
  // to the generic accent. `prev.courses` is what stops a refresh repainting
  // every course a student has already learned the colour of.
  const courses = coursesFrom(
    [...fromFeed, ...kept.filter((a) => !HAND_ADDED.test(a.id))],
    prev.courses,
  );

  return {
    assignments, courses, added: addedIds.length, updated, addedIds, movedIds,
    removed: removedIds.length, removedIds,
    retired: retiredIds.length, retiredIds,
  };
}

/** One sentence naming what a refresh did, or null when it changed nothing. */
export function describeMerge(r: MergeResult): string | null {
  const parts: string[] = [];
  if (r.added > 0) parts.push(`${r.added} new`);
  if (r.updated > 0) parts.push(`${r.updated} changed`);
  if (r.removed > 0) parts.push(`${r.removed} no longer in Canvas`);
  if (r.retired > 0) {
    parts.push(`${r.retired} you had started ${r.retired === 1 ? 'was' : 'were'} removed from Canvas and ${r.retired === 1 ? 'is' : 'are'} no longer planned`);
  }
  if (parts.length === 0) return null;
  return parts.join(', ');
}

/**
 * A fetched Canvas set, applied to a whole state.
 *
 * Lives here rather than in the hook so the import page, the week's refresh
 * button and `scripts/refresh-week.ts` all go through exactly one path. A
 * refresh that works in the terminal and differs in the browser is the kind of
 * divergence nobody finds until a student does.
 */
export function applyCanvas(prev: HeronState, incoming: Assignment[], at: string): {
  next: HeronState;
  merge: MergeResult;
} {
  const merge = mergeCanvasImport(prev, incoming);
  const gone = new Set(merge.removedIds);
  const retired = new Set(merge.retiredIds);

  return {
    merge,
    next: {
      ...prev,
      courses: merge.courses,
      assignments: merge.assignments,
      // An assignment that left Canvas takes its sessions with it, skipped ones
      // included. Left behind, they render as study blocks for work that no
      // longer exists, and nothing can be tapped into. Only untouched work is
      // ever removed, so no logged minute goes with them.
      blocks: prev.blocks.filter((b) => {
        if (!b.assignmentId) return true;
        if (gone.has(b.assignmentId)) return false;
        // Pinned or not. A hand-placed session for deleted homework is still
        // a session for deleted homework, and replan would keep a pinned one.
        if (retired.has(b.assignmentId)) return b.status !== 'planned';
        return true;
      }),
      canvasSyncedAt: at,
    },
  };
}
