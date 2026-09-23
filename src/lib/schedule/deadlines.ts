/**
 * Deadlines, next to the time set aside for them.
 *
 * The calendar drew study blocks and nothing else, so the two facts a student
 * actually reasons with were never on screen together: when the thing is due,
 * and when they are meant to be doing it. A block for Problem Set 5 on Tuesday
 * means something different when PS5 is due Wednesday than when it is due in a
 * fortnight, and a deadline with no sessions before it is the single most
 * important thing the week can show.
 *
 * Pure, so the status rules can be tested without rendering anything.
 */

import type { Assignment, StudyBlock } from '../types.ts';
import type { UnscheduledItem } from './plan.ts';
import { dueInstant } from './plan.ts';
import { localParts } from '../time.ts';

export type DeadlineStatus =
  /** Marked done, or every minute of the estimate has been logged. */
  | 'done'
  /** Has sessions still to come before it is due. */
  | 'planned'
  /** The planner could not fit all of it: it is on the "didn't fit" list. */
  | 'short'
  /** Due, not done, and nothing planned: the one that needs attention. */
  | 'unplanned'
  /** Due already, and not marked done. */
  | 'past';

export interface Deadline {
  id: string;
  title: string;
  course: string;
  /** The instant it is due. All-day items are due at the end of their day. */
  dueAt: string;
  allDay: boolean;
  url: string | null;
  status: DeadlineStatus;
  /** Sessions still to come. */
  planned: number;
  /** Sessions finished, in full or in part. */
  done: number;
  /** When the last planned session ends, so the gap before the deadline can be shown. */
  lastSessionEnd: string | null;
}

export function deadlineFor(
  a: Assignment,
  blocks: StudyBlock[],
  unscheduled: UnscheduledItem[],
  now: Date,
  tz: string,
): Deadline {
  const due = dueInstant(a, tz);
  const mine = blocks.filter((b) => b.assignmentId === a.id);
  const planned = mine.filter((b) => b.status === 'planned' && Date.parse(b.end) > now.getTime());
  const done = mine.filter((b) => b.status === 'done' || b.status === 'partial').length;
  const lastSessionEnd = planned.length
    ? planned.reduce((m, b) => (b.end > m ? b.end : m), planned[0].end)
    : null;

  let status: DeadlineStatus;
  if (a.status === 'done' || a.status === 'dropped') status = 'done';
  else if (due.getTime() < now.getTime()) status = 'past';
  else if (unscheduled.some((u) => u.assignmentId === a.id)) status = 'short';
  else if (planned.length > 0) status = 'planned';
  else status = 'unplanned';

  return {
    id: a.id,
    title: a.title,
    course: a.course,
    dueAt: due.toISOString(),
    allDay: a.allDay,
    url: a.url,
    status,
    planned: planned.length,
    done,
    lastSessionEnd,
  };
}

/** Every deadline falling on one of `days`, keyed by local date, in due order. */
export function deadlinesByDay(
  assignments: Assignment[],
  blocks: StudyBlock[],
  unscheduled: UnscheduledItem[],
  days: string[],
  now: Date,
  tz: string,
): Map<string, Deadline[]> {
  const wanted = new Set(days);
  const out = new Map<string, Deadline[]>();

  for (const a of assignments) {
    // Dropped work is the student saying it no longer exists for them.
    if (a.status === 'dropped') continue;
    const d = deadlineFor(a, blocks, unscheduled, now, tz);
    const key = localParts(new Date(d.dueAt), tz).dateKey;
    if (!wanted.has(key)) continue;
    const list = out.get(key) ?? [];
    list.push(d);
    out.set(key, list);
  }

  for (const list of out.values()) list.sort((x, y) => x.dueAt.localeCompare(y.dueAt));
  return out;
}

/** Short words for a status, for chips and screen readers. */
export function statusLabel(d: Deadline): string {
  switch (d.status) {
    case 'done': return 'done';
    case 'past': return 'past due';
    case 'short': return "didn't fully fit";
    case 'unplanned': return 'no time planned';
    case 'planned': return `${d.planned} session${d.planned === 1 ? '' : 's'} planned`;
  }
}
