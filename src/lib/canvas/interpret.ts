/**
 * Canvas-specific interpretation.
 *
 * The ICS parser gives us generic calendar events. This turns them into things
 * the scheduler can reason about: which course, what kind of work, roughly how
 * long, and how much it's worth.
 *
 * All the defaults here are guesses. That's fine and deliberate — the product
 * corrects them from observed data (see `reviseEstimate`). A wrong-but-adjusting
 * estimate beats asking a student to enter durations for forty assignments.
 */

import { categoryForAssignment, nextShade } from '../categories.ts';
import type { Assignment, Course, WorkKind } from '../types.ts';
import { parseICS } from './ics.ts';
import { DEFAULT_TZ, mondayOf } from '../time.ts';

export { mondayOf };

/**
 * Classify by title. Order matters: specific words beat generic ones, because
 * "Major Paper 2 Final" is a writing deadline, not an exam.
 */
export function classifyWork(title: string): WorkKind {
  const t = title.toLowerCase();
  if (/\b(essay|paper|draft|memo|thesis)\b/.test(t)) return 'writing';
  if (/\b(lab|prelab|post-?lab)\b/.test(t)) return 'lab';
  if (/\b(quiz)\b/.test(t)) return 'quiz';
  if (/\b(final exam|midterm|exam|test)\b/.test(t)) return 'exam';
  if (/\bfinal\b/.test(t) && !/\b(project|presentation|report|draft|paper)\b/.test(t)) return 'exam';
  if (/\b(problem set|pset|homework|hw|webassign|exercise)\b/.test(t)) return 'problem set';
  if (/\b(read|reading|chapter|response)\b/.test(t)) return 'reading';
  if (/\b(discussion|post|forum|reply)\b/.test(t)) return 'discussion';
  if (/\b(project|presentation|milestone|assignment)\b/.test(t)) return 'project';
  return 'other';
}

/**
 * Seed durations, in minutes. Deliberately conservative on the low side —
 * students abandon a planner that fills every waking hour on day one far faster
 * than they abandon one that under-books them.
 */
const BASE_MINUTES: Record<WorkKind, number> = {
  exam: 300,
  quiz: 90,
  'problem set': 120,
  writing: 180,
  reading: 60,
  lab: 120,
  project: 240,
  discussion: 30,
  other: 60,
};

/** Share of the final grade, as a fraction. Overridden by syllabus parsing later. */
const BASE_WEIGHT: Record<WorkKind, number> = {
  exam: 0.25,
  quiz: 0.05,
  'problem set': 0.03,
  writing: 0.15,
  reading: 0.02,
  lab: 0.05,
  project: 0.20,
  discussion: 0.01,
  other: 0.03,
};

export function estimateMinutes(kind: WorkKind, title: string): number {
  let minutes = BASE_MINUTES[kind];
  const t = title.toLowerCase();
  // A "final" of anything is bigger than the mid-quarter version of the same thing.
  if (/\bfinal\b/.test(t)) minutes = Math.round(minutes * 1.5);
  if (/\b(midterm)\b/.test(t)) minutes = Math.round(minutes * 1.2);
  return minutes;
}

export function defaultWeight(kind: WorkKind, title: string): number {
  let w = BASE_WEIGHT[kind];
  if (/\bfinal\b/i.test(title)) w *= 1.6;
  return Math.min(w, 0.4);
}

/** "CHEM 142 AA" → "CHEM 142". Section suffixes are noise for scheduling. */
export function normaliseCourse(label: string): string {
  return label.replace(/\s+[A-Z]{1,3}\d?$/, '').trim();
}

/**
 * Canvas writes summaries as "Problem Set 4 [CHEM 142 A]" and UIDs as
 * "event-assignment-9871234" for real assignments vs "event-calendar-event-..."
 * for office hours and the like.
 */
export function assignmentsFromICS(
  raw: string,
  opts: { tz?: string; includeNonAssignments?: boolean } = {},
): Assignment[] {
  const tz = opts.tz ?? DEFAULT_TZ;
  const events = parseICS(raw, tz);
  const out: Assignment[] = [];

  for (const ev of events) {
    if (!ev.start) continue;

    const isAssignment = /assignment/i.test(ev.uid || '');
    if (!isAssignment && !opts.includeNonAssignments) continue;

    const rawSummary = ev.summary || '(untitled)';
    const m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(rawSummary);
    const title = m ? m[1].trim() : rawSummary;
    const courseFull = m ? m[2].trim() : 'Unknown course';
    const kind = classifyWork(title);

    out.push({
      id: ev.uid || `${courseFull}:${title}:${ev.start.date.toISOString()}`,
      title,
      course: normaliseCourse(courseFull),
      courseFull,
      kind,
      due: ev.start.date.toISOString(),
      allDay: ev.start.allDay,
      url: ev.url ?? null,
      estimatedMinutes: estimateMinutes(kind, title),
      actualMinutes: 0,
      status: 'todo',
      weight: defaultWeight(kind, title),
      confidence: 0.5,
      lastTouched: null,
    });
  }

  out.sort((a, b) => a.due.localeCompare(b.due));
  return out;
}

/**
 * Courses from a feed, keeping the shades any of them already had.
 *
 * `existing` matters more than it looks. Re-importing a feed rebuilds this list,
 * and assigning shades by position would mean adding one course silently
 * recolours every course after it. A student who has learned that blue is CHEM
 * should not have that taken away by a sync.
 */
export function coursesFrom(assignments: Assignment[], existing: Course[] = []): Course[] {
  const seen = new Map<string, string>();
  for (const a of assignments) {
    if (!seen.has(a.course)) seen.set(a.course, a.courseFull);
  }

  const held = new Map(existing.map((c) => [c.code, c.shade]));
  const category = categoryForAssignment();
  const taken: number[] = [];

  // Known courses keep their shade and claim it first, so a new course fills a
  // genuinely free slot rather than colliding with one that is merely later.
  for (const code of seen.keys()) {
    const s = held.get(code);
    if (typeof s === 'number') taken.push(s);
  }

  return [...seen].map(([code, fullName]) => {
    let shade = held.get(code);
    if (typeof shade !== 'number') {
      shade = nextShade(category, taken);
      taken.push(shade);
    }
    return { code, fullName, category, shade };
  });
}

/**
 * Blend the seed estimate with what actually happened.
 *
 * Students systematically underestimate, so once we have real data we trust it,
 * but not instantly — one 4-hour problem set shouldn't convince us every problem
 * set takes 4 hours. A 60/40 blend toward observed reality converges over a
 * quarter without lurching.
 */
export function reviseEstimate(seedMinutes: number, observedMinutes: number[]): number {
  if (observedMinutes.length === 0) return seedMinutes;
  const mean = observedMinutes.reduce((s, x) => s + x, 0) / observedMinutes.length;
  const trust = Math.min(0.6, 0.2 * observedMinutes.length);
  return Math.round(seedMinutes * (1 - trust) + mean * trust);
}

/** Weekly workload buckets — the chart that makes the pitch concrete. */
export function workloadByWeek(
  assignments: Assignment[],
  tz = DEFAULT_TZ,
): Array<{ weekStart: string; count: number; minutes: number; hasExam: boolean }> {
  const buckets = new Map<string, Assignment[]>();

  for (const a of assignments) {
    const key = mondayOf(new Date(a.due), tz);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(a);
  }

  return [...buckets]
    .sort((x, y) => x[0].localeCompare(y[0]))
    .map(([weekStart, list]) => ({
      weekStart,
      count: list.length,
      minutes: list.reduce((s, a) => s + a.estimatedMinutes, 0),
      hasExam: list.some((a) => a.kind === 'exam'),
    }));
}
