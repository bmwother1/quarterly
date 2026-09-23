/**
 * Thousands of simulated students, run through the planner the way the app
 * runs it, and checked against the promises the planner makes.
 *
 * The print-a-week scripts have each caught a bug no test did, but each prints
 * a week somebody already thought to look at. This looks at the weeks nobody
 * thought of: odd ceilings, shifts on top of classes, a replan at 3am, a week
 * the clocks change in, three weeks of a student who does most of the plan and
 * skips the rest.
 *
 *   npm run sweep                                   5,000 scenarios, seed 1
 *   npm run sweep -- --seed 7 --scenarios 20000
 *   npm run sweep -- --seed 7 --only 1234           one scenario, every plan
 *   npm run sweep -- --seed 7 --only 1234 --plan 3  and that plan's input and output, in full
 *   npm run sweep -- --dump e                       every break of promise e, as it happens
 *
 * Deterministic: the same seed runs the same students. A failure prints its
 * seed and scenario, and a reduced copy of the planner input that still breaks
 * the same promise. Exits non-zero on any failure. Warnings (a day with room
 * left empty while work went unplanned) are printed but never fail the run,
 * because some of them are right.
 */

import type {
  Assignment, Availability, BusyBlock, Commitment, CommitmentCategory, EnergyPattern,
  FixedEvent, StudyBlock,
} from '../src/lib/types.ts';
import { WORK_KINDS } from '../src/lib/types.ts';
import { dueInstant, planWeek, type PlanOptions, type PlanResult } from '../src/lib/schedule/plan.ts';
import {
  applyCompletion, applyLearnedEstimates, dropRemaining, markAssignmentDone, resetWeeklyTallies, type Completion,
} from '../src/lib/schedule/complete.ts';
import { pushAside, releaseForEvents } from '../src/lib/schedule/conflicts.ts';
import { releaseMissed } from '../src/lib/schedule/absence.ts';
import { freeSlots } from '../src/lib/schedule/slots.ts';
import { MIN_SESSION_MINUTES, SESSION_MINUTES } from '../src/lib/schedule/score.ts';
import { addDays, localParts, mondayOf, weekdayOf, zonedInstant } from '../src/lib/time.ts';

// ── Arguments ─────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const SEED = Number(arg('seed') ?? 1);
const SCENARIOS = Number(arg('scenarios') ?? 5000);
const ONLY = arg('only') === undefined ? null : Number(arg('only'));
const DUMP = arg('dump') ?? null;
const PLAN = arg('plan') === undefined ? null : Number(arg('plan'));

// Mirrors of the planner defaults this script has to reason about.
const BUFFER_FRACTION = 0.2;
const BREAK_MS = 15 * 60_000;
const HORIZON_DAYS = 14;
const BUDGET_MS = 100;

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ── Randomness ────────────────────────────────────────────────────────────────

interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
}

/** Every scenario gets its own stream, so `--only` reruns one without the rest. */
function rng(seed: number, index: number): Rng {
  let a = (Math.imul(seed, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca77)) >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
  };
}

// ── Students ──────────────────────────────────────────────────────────────────

const ZONES = ['America/Los_Angeles', 'America/New_York', 'Asia/Tokyo'];
const COURSES = ['CSE 121', 'MATH 124', 'CHEM 142', 'ENGL 131', 'PHYS 121'];
const ENERGY: EnergyPattern[] = ['morning', 'evening', 'steady', 'bimodal'];
const CATEGORIES: CommitmentCategory[] = ['fitness', 'project', 'learning', 'personal'];
const FIRST_DAY = '2026-09-28';
const SPAN_DAYS = 40;
/** The US clocks go back on 1 November 2026. */
const DST_DAYS = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];

function makeAvailability(r: Rng): Availability {
  const busy: BusyBlock[] = [];

  // Sleep that wraps past midnight, or starts after it.
  const wraps = r.chance(0.7);
  for (let day = 0; day < 7; day++) {
    busy.push(wraps
      ? { id: `sleep-${day}`, day, startMin: r.int(88, 94) * 15, endMin: r.int(24, 32) * 15, label: 'Sleep', kind: 'sleep' }
      : { id: `sleep-${day}`, day, startMin: r.int(0, 4) * 15, endMin: r.int(26, 32) * 15, label: 'Sleep', kind: 'sleep' });
  }

  const patterns = [[0, 2, 4], [1, 3], [0, 1, 2, 3, 4]];
  for (let k = r.int(0, 4); k > 0; k--) {
    const startMin = r.int(34, 64) * 15;
    const length = r.pick([50, 80, 110]);
    for (const day of r.pick(patterns)) {
      busy.push({ id: `class-${k}-${day}`, day, startMin, endMin: startMin + length, label: `Class ${k}`, kind: 'class' });
    }
  }

  if (r.chance(0.3)) {
    const startMin = r.int(6, 14) * 60;
    const endMin = Math.min(23 * 60, startMin + r.int(4, 9) * 60);
    for (let day = 0; day < 7; day++) {
      if (r.chance(0.5)) busy.push({ id: `work-${day}`, day, startMin, endMin, label: 'Work', kind: 'work' });
    }
  }

  return {
    busy,
    dayStartMin: r.pick([6, 7, 8, 9, 10]) * 60 + r.pick([0, 30]),
    dayEndMin: r.pick([20 * 60, 21 * 60, 22 * 60, 23 * 60, 23 * 60 + 30]),
    energy: r.pick(ENERGY),
    energyLocked: r.chance(0.3),
    maxDailyMinutes: r.int(4, 40) * 15,
    maxDailyMinutesByDay: r.chance(0.4)
      ? Array.from({ length: 7 }, () => (r.chance(0.5) ? null : r.int(0, 16) * 30))
      : undefined,
  };
}

function makeAssignments(r: Rng, tz: string, start: Date, spanDays: number): Assignment[] {
  const out: Assignment[] = [];
  for (let i = r.int(0, 25); i > 0; i--) {
    const kind = r.pick(WORK_KINDS);
    const course = r.pick(COURSES);

    const roll = r.next();
    let due =
      roll < 0.05 ? new Date(start.getTime() + r.int(5, 60) * MIN)      // due within the hour
      : roll < 0.15 ? new Date(start.getTime() - r.int(1, 72) * HOUR)   // already overdue
      : new Date(start.getTime() + r.int(1, spanDays * 24) * HOUR);
    const allDay = r.chance(0.25);
    if (allDay) due = zonedInstant(localParts(due, tz).dateKey, 0, tz);

    const estimatedMinutes = r.chance(0.1) ? r.int(15, 40) : r.int(2, 40) * 15;
    out.push({
      id: `a${i}`, title: `${kind} ${i}`, course, courseFull: `${course} A`, kind,
      due: due.toISOString(), allDay, url: null,
      estimatedMinutes,
      actualMinutes: r.chance(0.2) ? r.int(0, estimatedMinutes) : 0,
      status: r.chance(0.92) ? 'todo' : r.pick(['done', 'dropped'] as const),
      weight: r.int(1, 40) / 100,
      confidence: r.next(),
      lastTouched: r.chance(0.3) ? new Date(start.getTime() - r.int(1, 10) * DAY).toISOString() : null,
    });
  }
  return out;
}

function makeCommitments(r: Rng): Commitment[] {
  const out: Commitment[] = [];
  for (let i = r.int(0, 4); i > 0; i--) {
    const windowed = r.chance(0.4);
    const windowStartMin = r.int(20, 72) * 15;
    out.push({
      id: `c${i}`, title: `Commitment ${i}`, category: r.pick(CATEGORIES),
      sessionsPerWeek: r.int(1, 7),
      minutesPerSession: r.int(4, 24) * 5,
      importance: r.next(),
      demand: r.next(),
      lastDoneAt: null,
      doneThisWeek: 0,
      maxPerDay: r.pick([1, 1, 1, 2, 3]),
      minSessionMinutes: r.pick([0, 20, 30, 45, 60]),
      bufferAfterMinutes: r.pick([0, 0, 10, 15, 30]),
      windowStartMin: windowed ? windowStartMin : null,
      windowEndMin: windowed ? Math.min(23 * 60 + 45, windowStartMin + r.int(6, 24) * 15) : null,
      active: r.chance(0.9),
      shade: 0,
    });
  }
  return out;
}

function makeEvents(r: Rng, tz: string, startKey: string, spanDays: number): FixedEvent[] {
  const out: FixedEvent[] = [];
  const event = (id: string, dateKey: string, startMin: number, endMin: number, category: FixedEvent['category']): FixedEvent => ({
    id, title: id, note: null, category, shade: 0,
    start: zonedInstant(dateKey, startMin, tz).toISOString(),
    end: zonedInstant(dateKey, endMin, tz).toISOString(),
  });

  for (let i = r.int(0, 8); i > 0; i--) {
    const dateKey = addDays(startKey, r.int(-1, spanDays));
    const roll = r.next();
    let e: FixedEvent;
    if (roll < 0.3) {
      const s = r.int(6, 15) * 60 + r.pick([0, 30]);
      e = event(`shift${i}`, dateKey, s, s + r.int(4, 9) * 60, 'work');
    } else if (roll < 0.4) {
      e = event(`allday${i}`, dateKey, 8 * 60, 22 * 60, 'personal');
    } else if (roll < 0.45) {
      e = event(`late${i}`, dateKey, 23 * 60, 25 * 60, 'personal');            // runs past midnight
    } else {
      const s = r.int(28, 88) * 15;
      e = event(`appt${i}`, dateKey, s, s + r.int(2, 12) * 15, 'personal');
    }
    out.push(e);

    if (r.chance(0.15)) {
      const shift = r.int(-60, 60) * MIN;
      out.push({
        ...e, id: `${e.id}b`, title: `${e.id}b`,
        start: new Date(Date.parse(e.start) + shift).toISOString(),
        end: new Date(Date.parse(e.end) + shift).toISOString(),
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

// ── The app's replan, without the React ───────────────────────────────────────

interface Sim {
  tz: string;
  availability: Availability;
  assignments: Assignment[];
  commitments: Commitment[];
  events: FixedEvent[];
  blocks: StudyBlock[];
  lastPlannedAt: string | null;
}

interface PlanInput {
  assignments: Assignment[];
  availability: Availability;
  options: Required<Pick<PlanOptions, 'now' | 'tz' | 'commitments' | 'existingBlocks' | 'events'>>;
}

const run = (i: PlanInput): PlanResult => planWeek(i.assignments, i.availability, i.options);

/** `replan` in src/hooks/use-heron.ts, line for line. */
function replan(sim: Sim, now: Date, onPlan: (input: PlanInput) => PlanResult): Sim {
  const commitments = resetWeeklyTallies(sim.commitments, sim.lastPlannedAt, now, sim.tz);
  const assignments = applyLearnedEstimates(sim.assignments);
  const settled = sim.blocks.filter((b) => b.status !== 'planned' || b.pinned);

  const result = onPlan({
    assignments,
    availability: sim.availability,
    options: { now, tz: sim.tz, commitments, existingBlocks: settled, events: sim.events },
  });

  return {
    ...sim,
    assignments,
    commitments,
    blocks: [...settled, ...result.blocks].sort((a, b) => a.start.localeCompare(b.start)),
    lastPlannedAt: now.toISOString(),
  };
}

/**
 * The student, between two replans: reports on what came due, leaves some of
 * it unreported, and does the other things the app lets them do. Each is the
 * domain function the app calls, never a copy of it.
 */
function live(sim: Sim, r: Rng, from: Date, to: Date): Sim {
  let s = sim;

  const due = s.blocks
    .filter((b) => b.status === 'planned' && Date.parse(b.end) > from.getTime() && Date.parse(b.end) <= to.getTime())
    .sort((a, b) => a.end.localeCompare(b.end));

  for (const b of due) {
    const roll = r.next();
    if (roll >= 0.85) continue;                                          // never reported
    const outcome: Completion = roll < 0.6 ? 'done' : roll < 0.72 ? 'partial' : 'skipped';
    const minutes =
      outcome === 'partial' ? Math.max(1, Math.round(b.minutes * (0.25 + 0.65 * r.next())))
      : outcome === 'done' && r.chance(0.2) ? Math.max(1, Math.round(b.minutes * (0.5 + 1.5 * r.next())))
      : null;
    const at = new Date(Math.min(Date.parse(b.end) + r.int(0, 180) * MIN, to.getTime()));
    s = { ...s, ...applyCompletion(s, b.id, outcome, minutes, at) };
  }

  // Ticks off a pinned block from days ago that was never reported.
  if (r.chance(0.1)) {
    const stale = s.blocks.filter((b) => b.status === 'planned' && b.pinned && Date.parse(b.end) <= from.getTime());
    if (stale.length > 0) s = { ...s, ...applyCompletion(s, r.pick(stale).id, 'done', null, to) };
  }

  // "I'm not doing this": dropRemaining in use-heron.ts.
  if (r.chance(0.05)) {
    const future = s.blocks.filter((b) => b.status === 'planned' && Date.parse(b.start) > to.getTime());
    if (future.length > 0) s = { ...s, ...dropRemaining(s, r.pick(future).id) };
  }

  // Handed something in without logging the time.
  if (r.chance(0.03)) {
    const open = s.assignments.filter((a) => a.status === 'todo');
    if (open.length > 0) s = { ...s, assignments: markAssignmentDone(s.assignments, r.pick(open).id, to) };
  }

  // Changes the daily ceiling in settings.
  if (r.chance(0.03)) s = { ...s, availability: { ...s.availability, maxDailyMinutes: r.int(4, 40) * 15 } };

  // Adds an appointment on top of planned work: addEvent in use-heron.ts
  // releases any pin it lands on, then replans.
  if (r.chance(0.05)) {
    const future = s.blocks.filter((b) => b.status === 'planned' && Date.parse(b.start) > to.getTime());
    if (future.length > 0) {
      const b = r.pick(future);
      const event: FixedEvent = {
        id: `added-${Date.parse(b.start)}`, title: 'Added', note: null, category: 'personal', shade: 0,
        start: new Date(Date.parse(b.start) - r.int(0, 4) * 15 * MIN).toISOString(),
        end: new Date(Date.parse(b.end) + r.int(0, 4) * 15 * MIN).toISOString(),
      };
      s = {
        ...s,
        events: [...s.events, event].sort((x, y) => x.start.localeCompare(y.start)),
        blocks: releaseForEvents(s.blocks, [event]),
      };
    }
  }

  // moveBlock in use-heron.ts: set the time, pin it, push aside what it lands on.
  if (r.chance(0.25)) {
    for (let k = r.int(1, 2); k > 0; k--) {
      const movable = s.blocks.filter((b) => b.status === 'planned' && Date.parse(b.start) > to.getTime());
      if (movable.length === 0) break;
      const target = r.pick(movable);
      const dayKey = addDays(localParts(to, s.tz).dateKey, r.int(0, 6));
      const startMs = zonedInstant(dayKey, r.int(20, 92) * 15, s.tz).getTime();
      if (startMs <= to.getTime()) continue;

      const moved = s.blocks.map((b) => (b.id !== target.id ? b : {
        ...b,
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + b.minutes * MIN).toISOString(),
        pinned: true,
      }));
      const { blocks } = pushAside(moved, target.id, { dayEndMin: s.availability.dayEndMin });
      s = { ...s, blocks: blocks.sort((a, b) => a.start.localeCompare(b.start)) };
    }
  }

  return s;
}

// ── The promises ──────────────────────────────────────────────────────────────

interface Violation {
  /** Which promise: a to j. */
  inv: string;
  kind: string;
  detail: string;
}

const key = (v: Violation) => `${v.inv}: ${v.kind}`;
const ms = (iso: string) => Date.parse(iso);
const overlapping = (a: { s: number; e: number }, b: { s: number; e: number }) => a.s < b.e && b.s < a.e;

/** Study a block puts on its day: reported for settled, length for planned, nothing for skipped. */
function study(b: StudyBlock): number {
  return b.status === 'skipped' ? 0 : b.status === 'planned' ? b.minutes : b.actualMinutes ?? b.minutes;
}

/** Busy intervals for one weekday, minutes after midnight. Written independently of slots.ts on purpose. */
function busyOn(av: Availability, weekday: number): Array<{ s: number; e: number; label: string }> {
  const out: Array<{ s: number; e: number; label: string }> = [];
  for (const b of av.busy) {
    const wraps = b.endMin <= b.startMin;
    if (b.day === weekday) out.push({ s: b.startMin, e: wraps ? 1440 : b.endMin, label: b.label });
    if (wraps && (b.day + 1) % 7 === weekday) out.push({ s: 0, e: b.endMin, label: b.label });
  }
  return out;
}

/** Local start and end, as minutes after the start date's midnight. */
function localSpan(startMs: number, endMs: number, tz: string) {
  const s = localParts(new Date(startMs), tz);
  const e = localParts(new Date(endMs), tz);
  return { dateKey: s.dateKey, startMin: s.minutesOfDay, endMin: e.dateKey === s.dateKey ? e.minutesOfDay : e.minutesOfDay + 1440 };
}

function check(input: PlanInput, result: PlanResult): Violation[] {
  const out: Violation[] = [];
  const av = input.availability;
  const { now, tz, existingBlocks: kept, events, commitments } = input.options;
  const added = result.blocks;
  const dayOf = (b: StudyBlock) => localParts(new Date(b.start), tz).dateKey;
  const ceilingOf = (dateKey: string) => av.maxDailyMinutesByDay?.[weekdayOf(dateKey)] ?? av.maxDailyMinutes;
  const commitmentOf = new Map(commitments.map((c) => [c.id, c]));
  const bufferOf = (b: StudyBlock) => (b.commitmentId ? commitmentOf.get(b.commitmentId)?.bufferAfterMinutes ?? 0 : 0);
  const held = (b: StudyBlock) => ({ s: ms(b.start), e: ms(b.end) + bufferOf(b) * MIN });

  // a. No local day goes over its ceiling because of what this plan added.
  const keptByDay = new Map<string, number>();
  for (const b of kept) keptByDay.set(dayOf(b), (keptByDay.get(dayOf(b)) ?? 0) + study(b));
  const addedByDay = new Map<string, number>();
  for (const b of added) addedByDay.set(dayOf(b), (addedByDay.get(dayOf(b)) ?? 0) + b.minutes);
  for (const [dateKey, minutes] of addedByDay) {
    const already = keptByDay.get(dateKey) ?? 0;
    const ceiling = ceilingOf(dateKey);
    if (minutes > Math.max(0, ceiling - already)) {
      out.push({ inv: 'a', kind: 'day over its ceiling', detail: `${dateKey}: ${already} already + ${minutes} planned against ${ceiling}` });
    }
  }

  // b. Nothing new lands on anything, or outside the day.
  for (const b of added) {
    const h = held(b);
    const span = localSpan(h.s, h.e, tz);
    if (h.s < now.getTime()) out.push({ inv: 'b', kind: 'starts in the past', detail: `${b.id} starts before ${now.toISOString()}` });
    if (span.startMin < av.dayStartMin || span.endMin > av.dayEndMin) {
      out.push({ inv: 'b', kind: 'outside the day', detail: `${b.id} ${span.dateKey} ${span.startMin}-${span.endMin} vs ${av.dayStartMin}-${av.dayEndMin}` });
    }
    for (const busy of busyOn(av, weekdayOf(span.dateKey))) {
      if (overlapping({ s: span.startMin, e: span.endMin }, busy)) {
        out.push({ inv: 'b', kind: `overlaps ${busy.label === 'Sleep' ? 'sleep' : 'a busy block'}`, detail: `${b.id} ${span.dateKey} ${span.startMin}-${span.endMin} vs ${busy.label} ${busy.s}-${busy.e}` });
      }
    }
    for (const e of events) {
      if (overlapping(h, { s: ms(e.start), e: ms(e.end) })) {
        out.push({ inv: 'b', kind: 'overlaps an event', detail: `${b.id} vs ${e.id}` });
      }
    }
    for (const k of kept) {
      if (overlapping(h, { s: ms(k.start), e: ms(k.end) })) {
        out.push({ inv: 'b', kind: `overlaps a kept ${k.status}${k.pinned ? ' pinned' : ''} block`, detail: `${b.id} vs ${k.id}` });
      }
    }
  }
  const sorted = [...added].sort((x, y) => ms(x.start) - ms(y.start));
  let reach: { e: number; id: string } | null = null;
  for (const b of sorted) {
    if (reach && ms(b.start) < reach.e) out.push({ inv: 'b', kind: 'overlaps another new block', detail: `${b.id} vs ${reach.id}` });
    const e = held(b).e;
    if (!reach || e > reach.e) reach = { e, id: b.id };
  }

  // c. Nothing ends after its deadline, and nothing finished or overdue is planned.
  const assignmentOf = new Map(input.assignments.map((a) => [a.id, a]));
  for (const b of added) {
    if (!b.assignmentId) continue;
    const a = assignmentOf.get(b.assignmentId);
    if (!a) { out.push({ inv: 'c', kind: 'plans an unknown assignment', detail: b.id }); continue; }
    if (a.status !== 'todo') out.push({ inv: 'c', kind: `plans ${a.status} work`, detail: b.id });
    const due = dueInstant(a, tz).getTime();
    if (due <= now.getTime()) out.push({ inv: 'c', kind: 'plans overdue work', detail: b.id });
    else if (ms(b.end) > due) out.push({ inv: 'c', kind: 'ends after its deadline', detail: `${b.id} ends ${b.end}, due ${new Date(due).toISOString()}` });
  }

  // c, continued. No more planned for an assignment than is left of it, counting
  // sessions already on the calendar. Session lengths round: up to the
  // 25-minute floor, or to five minutes, and either way the overshoot stays
  // under 25.
  for (const a of input.assignments) {
    const fresh = added.filter((b) => b.assignmentId === a.id);
    if (fresh.length === 0) continue;
    const pinned = kept.filter((b) => b.assignmentId === a.id && b.status === 'planned');
    const planned = [...fresh, ...pinned].reduce((t, b) => t + b.minutes, 0);
    const left = Math.max(0, a.estimatedMinutes - a.actualMinutes);
    if (planned >= left + 25) {
      out.push({
        inv: 'c', kind: 'plans more than the work left',
        detail: `${a.id}: ${fresh.length} new and ${pinned.length} kept planned, ${planned} min for ${left} min left`,
      });
    }
  }

  // d. No fragment, and a block is as long as it says.
  for (const b of added) {
    if (b.minutes < MIN_SESSION_MINUTES) {
      out.push({ inv: 'd', kind: 'shorter than the minimum session', detail: `${b.id} is ${b.minutes} min` });
    }
    if (ms(b.end) - ms(b.start) !== b.minutes * MIN) {
      out.push({ inv: 'd', kind: 'length disagrees with its times', detail: b.id });
    }
  }

  // e. Commitments keep their quota, their per-day limit and their window.
  for (const c of commitments) {
    const mine = added.filter((b) => b.commitmentId === c.id);
    if (mine.length === 0) continue;
    if (!c.active) out.push({ inv: 'e', kind: 'plans an inactive commitment', detail: c.id });

    const all = [...kept, ...mine].filter((b) => b.commitmentId === c.id && b.status !== 'skipped');
    for (const week of new Set(mine.map((b) => mondayOf(new Date(b.start), tz)))) {
      const inWeek = all.filter((b) => mondayOf(new Date(b.start), tz) === week);
      if (inWeek.length > c.sessionsPerWeek) {
        const count = (f: (b: StudyBlock) => boolean) => inWeek.filter(f).length;
        out.push({
          inv: 'e', kind: 'over its weekly quota',
          detail: `${c.id} week of ${week}: ${inWeek.length} of ${c.sessionsPerWeek} ` +
            `(${count((b) => b.status !== 'planned')} reported, ${count((b) => b.status === 'planned' && !mine.includes(b))} kept planned, ` +
            `${count((b) => mine.includes(b))} new; doneThisWeek ${c.doneThisWeek})`,
        });
      }
    }
    for (const day of new Set(mine.map(dayOf))) {
      const onDay = all.filter((b) => dayOf(b) === day).length;
      if (onDay > c.maxPerDay) out.push({ inv: 'e', kind: 'over its daily limit', detail: `${c.id} ${day}: ${onDay} against ${c.maxPerDay} a day` });
    }
    if (c.windowStartMin !== null && c.windowEndMin !== null) {
      for (const b of mine) {
        const span = localSpan(ms(b.start), ms(b.end) + c.bufferAfterMinutes * MIN, tz);
        if (span.startMin < c.windowStartMin || span.endMin > c.windowEndMin) {
          out.push({ inv: 'e', kind: 'outside its window', detail: `${b.id} ${span.startMin}-${span.endMin} vs ${c.windowStartMin}-${c.windowEndMin}` });
        }
      }
    }
  }

  // j. Every reason reads as English. The planner has shipped "due in 1 hours".
  for (const b of added) {
    const bad = b.why.match(/\b1 (hours|days|sessions)\b|\b0 (hours|days)\b|NaN|undefined|Infinity|\bnull\b|^\s*$/);
    if (bad) out.push({ inv: 'j', kind: 'a reason that does not read', detail: `${b.id}: "${b.why}"` });
  }

  // i. Ids stay unique across what was kept and what is new. React keys on them.
  const ids = new Set<string>();
  for (const b of [...kept, ...added]) {
    if (ids.has(b.id)) out.push({ inv: 'i', kind: 'duplicate block id', detail: b.id });
    ids.add(b.id);
  }

  return out;
}

/**
 * g. A day with room in it left empty while work went unplanned for want of
 * room. A warning, not a failure: a session chained behind one that did not
 * fit, or exam prep kept to separate days, can leave this honestly.
 *
 * "Room" means a gap and an allowance that hold the session at the length it
 * was planned at. The planner trims a session only to the day's remaining
 * allowance, never to fit a gap or a window, so a smaller gap is not room.
 */
function emptyRoomyDays(input: PlanInput, result: PlanResult): string[] {
  if (result.unscheduled.length === 0) return [];
  const av = input.availability;
  const { now, tz, existingBlocks: kept, events, commitments } = input.options;
  const dayOf = (iso: string) => localParts(new Date(iso), tz).dateKey;
  const slots = freeSlots(av, now, HORIZON_DAYS, tz, MIN_SESSION_MINUTES);
  const warnings: string[] = [];

  const busySpans = [
    ...kept.map((b) => ({ s: ms(b.start) - BREAK_MS, e: ms(b.end) + BREAK_MS })),
    ...events.map((e) => ({ s: ms(e.start) - BREAK_MS, e: ms(e.end) + BREAK_MS })),
  ];

  for (const dateKey of new Set(slots.map((s) => s.dateKey))) {
    if (result.blocks.some((b) => dayOf(b.start) === dateKey)) continue;

    const daySlots = slots.filter((s) => s.dateKey === dateKey);
    const free = daySlots.reduce((t, s) => t + s.minutes, 0);
    const onDay = kept.filter((b) => dayOf(b.start) === dateKey);
    const studied = onDay.reduce((t, b) => t + study(b), 0);
    const heldInFree = onDay.filter((b) => study(b) > 0).reduce((t, b) => t + daySlots.reduce(
      (u, s) => u + Math.max(0, Math.min(ms(b.end), s.end.getTime()) - Math.max(ms(b.start), s.start.getTime())) / MIN, 0), 0);
    const ceiling = av.maxDailyMinutesByDay?.[weekdayOf(dateKey)] ?? av.maxDailyMinutes;
    const allowance = Math.min(ceiling - studied, Math.floor(free * (1 - BUFFER_FRACTION)) - heldInFree);
    if (allowance < MIN_SESSION_MINUTES) continue;

    // Open gaps of an hour or more, after everything already there.
    const gaps: Array<{ s: number; e: number }> = [];
    for (const slot of daySlots) {
      let pieces = [{ s: slot.start.getTime(), e: slot.end.getTime() }];
      for (const b of busySpans) {
        pieces = pieces.flatMap((p) => (!overlapping(p, b) ? [p] : [{ s: p.s, e: b.s }, { s: b.e, e: p.e }].filter((q) => q.e > q.s)));
      }
      gaps.push(...pieces.filter((p) => p.e - p.s >= MIN_SESSION_MINUTES * MIN));
    }
    if (gaps.length === 0) continue;

    const fits = result.unscheduled.filter((u) => {
      if (u.assignmentId) {
        const a = input.assignments.find((x) => x.id === u.assignmentId);
        if (!a) return false;
        const due = dueInstant(a, tz).getTime();
        const spaced = a.kind === 'exam' || a.kind === 'quiz';
        if (spaced && onDay.some((b) => b.assignmentId === a.id && b.status !== 'skipped')) return false;
        const need = Math.min(sessionLength(a, kept), allowance);
        return gaps.some((g) => g.e - g.s >= need * MIN && g.s + need * MIN <= due);
      }
      const c = commitments.find((x) => x.id === u.commitmentId);
      if (!c) return false;
      const done = onDay.filter((b) => b.commitmentId === c.id && b.status !== 'skipped').length;
      if (done >= c.maxPerDay) return false;

      // A shortfall only belongs to this day if this day's week is short. The
      // report lumps every week together, and a week the horizon cuts off is
      // short of horizon, not of room.
      const monday = mondayOf(zonedInstant(dateKey, 12 * 60, tz), tz);
      const current = monday === mondayOf(now, tz);
      const weekEnd = zonedInstant(addDays(monday, 6), 23 * 60 + 59, tz).getTime();
      if (!current && weekEnd > now.getTime() + HORIZON_DAYS * DAY) return false;
      const inWeek = [...kept, ...result.blocks].filter((b) =>
        b.commitmentId === c.id && b.status !== 'skipped' && mondayOf(new Date(b.start), tz) === monday);
      const reported = inWeek.filter((b) => b.status !== 'planned').length;
      const count = current ? Math.max(c.doneThisWeek, reported) + inWeek.length - reported : inWeek.length;
      if (count >= c.sessionsPerWeek) return false;
      const length = Math.min(Math.max(c.minutesPerSession, MIN_SESSION_MINUTES), 90);
      if (allowance < length + c.bufferAfterMinutes) return false;
      const need = length + c.bufferAfterMinutes;
      return gaps.some((g) => {
        const s = localSpan(g.s, g.e, tz);
        const from = Math.max(s.startMin, c.windowStartMin ?? 0);
        const to = Math.min(s.endMin, c.windowEndMin ?? 1440);
        return to - from >= need;
      });
    });
    if (fits.length === 0) continue;

    const longest = Math.max(...gaps.map((g) => (g.e - g.s) / MIN));
    warnings.push(
      `${dateKey} left empty with ${allowance} min of allowance and a ${longest} min gap, ` +
      `while ${fits.length} item(s) went unplanned: ${fits.slice(0, 3).map((u) => `${u.title} (${u.reason})`).join('; ')}`,
    );
  }
  return warnings;
}

/** The length the planner gives each of an assignment's sessions, before any trim for a full day. */
function sessionLength(a: Assignment, kept: StudyBlock[]): number {
  const pinned = kept.filter((b) => b.assignmentId === a.id && b.status === 'planned').reduce((t, b) => t + b.minutes, 0);
  const left = Math.max(0, a.estimatedMinutes - a.actualMinutes - pinned);
  const count = Math.max(1, Math.min(8, Math.ceil(left / SESSION_MINUTES[a.kind])));
  return Math.max(Math.min(MIN_SESSION_MINUTES, left), Math.min(90, Math.round(left / count / 5) * 5));
}

/**
 * Commitments whose window, inside the student's day, is shorter than one
 * session and its buffer. They can never be placed, and every replan reports
 * them as "the week ran out before you hit the target".
 */
function windowTooShort(input: PlanInput, result: PlanResult): string[] {
  const av = input.availability;
  return result.unscheduled.flatMap((u) => {
    const c = input.options.commitments.find((x) => x.id === u.commitmentId);
    if (!c || c.windowStartMin === null || c.windowEndMin === null) return [];
    const length = Math.min(Math.max(c.minutesPerSession, MIN_SESSION_MINUTES), 90);
    const room = Math.min(c.windowEndMin, av.dayEndMin) - Math.max(c.windowStartMin, av.dayStartMin);
    return room < length + c.bufferAfterMinutes
      ? [`${c.id}: ${length} min + ${c.bufferAfterMinutes} buffer, ${Math.max(0, room)} min of window inside the day, reported as "${u.reason}"`]
      : [];
  });
}

// ── Running a plan: every promise, plus determinism and time ──────────────────

const snapshot = (x: unknown) => JSON.stringify(x);

function planAndCheck(input: PlanInput): { result: PlanResult; violations: Violation[]; warnings: string[]; ms: number } {
  const before = snapshot(input);
  const t0 = performance.now();
  const result = run(input);
  let elapsed = performance.now() - t0;
  const again = run(structuredClone(input));

  const violations = check(input, result);

  // f. Same input, same output, and the input is left alone.
  if (snapshot(input) !== before) violations.push({ inv: 'f', kind: 'mutates its input', detail: '' });
  if (snapshot(result) !== snapshot(again)) violations.push({ inv: 'f', kind: 'same input, different output', detail: '' });

  // h. Fast enough. A slow run is timed again, so one GC pause is not a failure.
  if (elapsed > BUDGET_MS) {
    for (let k = 0; k < 3; k++) {
      const t = performance.now();
      run(structuredClone(input));
      elapsed = Math.min(elapsed, performance.now() - t);
    }
    if (elapsed > BUDGET_MS) violations.push({ inv: 'h', kind: 'slower than the budget', detail: `${elapsed.toFixed(0)}ms` });
  }

  return { result, violations, warnings: emptyRoomyDays(input, result), ms: elapsed };
}

// ── One student ───────────────────────────────────────────────────────────────

interface Finding { count: number; scenario: number; step: number; violation: Violation; input: PlanInput }

const findings = new Map<string, Finding>();
const warnings: Array<{ scenario: number; step: number; text: string }> = [];
const timings: number[] = [];
let slowest = { ms: 0, scenario: 0, step: 0 };
let plans = 0;
const windowConflicts: { count: number; first: string | null } = { count: 0, first: null };

function runScenario(index: number, verbose: boolean): void {
  const r = rng(SEED, index);
  const tz = r.pick(ZONES);
  const startKey = r.chance(0.15) ? r.pick(DST_DAYS) : addDays(FIRST_DAY, r.int(0, SPAN_DAYS));
  // Every hour of the day gets replanned at, evenly.
  const t0 = zonedInstant(startKey, (index % 24) * 60 + r.int(0, 59), tz);
  const multiWeek = r.chance(0.2);

  let step = 0;
  const onPlan = (input: PlanInput): PlanResult => {
    const { result, violations, warnings: w, ms: elapsed } = planAndCheck(input);
    plans += 1;
    timings.push(elapsed);
    if (elapsed > slowest.ms) slowest = { ms: elapsed, scenario: index, step };
    for (const v of violations) {
      if (DUMP === v.inv) console.log(`    ${key(v)} · --only ${index}, plan ${step} · ${v.detail}`);
      const f = findings.get(key(v));
      if (f) f.count += 1;
      else findings.set(key(v), { count: 1, scenario: index, step, violation: v, input: structuredClone(input) });
    }
    for (const text of w) warnings.push({ scenario: index, step, text });
    for (const text of windowTooShort(input, result)) {
      windowConflicts.count += 1;
      if (!windowConflicts.first) windowConflicts.first = `--only ${index} --plan ${step}: ${text}`;
    }
    if (verbose) {
      console.log(`  plan ${step} at ${input.options.now.toISOString()} (${localParts(input.options.now, tz).dateKey} ` +
        `${String(localParts(input.options.now, tz).hour).padStart(2, '0')}:00 local): ${result.blocks.length} new, ` +
        `${input.options.existingBlocks.length} kept, ${result.unscheduled.length} unplanned, ${elapsed.toFixed(1)}ms`);
      for (const v of violations) console.log(`    ✖ ${key(v)}  ${v.detail}`);
      for (const text of w) console.log(`    ! ${text}`);
      if (PLAN === step) {
        const when = (iso: string) => {
          const p = localParts(new Date(iso), tz);
          return `${p.dateKey} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
        };
        for (const b of input.options.existingBlocks) console.log(`      kept ${when(b.start)} ${b.minutes}m ${b.id} ${b.status}${b.pinned ? ' pinned' : ''}`);
        for (const b of result.blocks) console.log(`      new  ${when(b.start)} ${b.minutes}m ${b.id}`);
        for (const u of result.unscheduled) console.log(`      unplanned ${u.title} ${u.minutes}m ${u.reason}${u.sessionsShort ? ` (${u.sessionsShort} short)` : ''}`);
        console.log(`      input ${JSON.stringify(input)}`);
      }
    }
    step += 1;
    return result;
  };

  const availability = makeAvailability(r);
  let sim: Sim = {
    tz,
    availability,
    assignments: makeAssignments(r, tz, t0, multiWeek ? 35 : 16),
    commitments: makeCommitments(r),
    events: makeEvents(r, tz, startKey, multiWeek ? 24 : 14),
    blocks: [],
    lastPlannedAt: null,
  };
  if (verbose) console.log(`  ${tz}, starting ${t0.toISOString()}, ${multiWeek ? 'three weeks' : 'one replan'}`);

  sim = replan(sim, t0, onPlan);

  if (!multiWeek) {
    const t1 = new Date(t0.getTime() + r.int(60, 36 * 60) * MIN);
    sim = live(sim, r, t0, t1);
    replan(sim, t1, onPlan);
    return;
  }

  let t = t0;
  for (let day = 1; day <= 21; day++) {
    // Now and then, gone for a few days, then "start fresh": releaseMissed and
    // a replan, as startFresh in use-heron.ts does.
    const away = r.chance(0.05);
    if (away) day += r.int(2, 4);

    const minute = Math.max(0, Math.min(1439, r.int(availability.dayStartMin - 120, availability.dayEndMin + 60)));
    let next = zonedInstant(addDays(startKey, day), minute, tz);
    if (next <= t) next = new Date(t.getTime() + HOUR);
    sim = away ? { ...sim, blocks: releaseMissed(sim.blocks, next) } : live(sim, r, t, next);
    sim = replan(sim, next, onPlan);
    t = next;

    if (r.chance(0.2)) {
      const later = new Date(t.getTime() + r.int(60, 300) * MIN);
      sim = live(sim, r, t, later);
      sim = replan(sim, later, onPlan);
      t = later;
    }
  }
}

// ── Reduction ─────────────────────────────────────────────────────────────────

/**
 * Throw away every part of the input that is not needed to break the same
 * promise, so a failure reads as three blocks and an event, not three weeks.
 */
function reduce(input: PlanInput, target: string): PlanInput {
  const breaks = (i: PlanInput) => {
    try { return check(i, run(i)).some((v) => key(v) === target); } catch { return false; }
  };

  type Lens = [(i: PlanInput) => unknown[], (i: PlanInput, v: unknown[]) => PlanInput];
  const lenses: Lens[] = [
    [(i) => i.assignments, (i, v) => ({ ...i, assignments: v as Assignment[] })],
    [(i) => i.options.commitments, (i, v) => ({ ...i, options: { ...i.options, commitments: v as Commitment[] } })],
    [(i) => i.options.existingBlocks, (i, v) => ({ ...i, options: { ...i.options, existingBlocks: v as StudyBlock[] } })],
    [(i) => i.options.events, (i, v) => ({ ...i, options: { ...i.options, events: v as FixedEvent[] } })],
    [(i) => i.availability.busy, (i, v) => ({ ...i, availability: { ...i.availability, busy: v as BusyBlock[] } })],
  ];

  let cur = input;
  for (let progress = true; progress;) {
    progress = false;
    for (const [get, set] of lenses) {
      for (let chunk = Math.max(1, Math.ceil(get(cur).length / 2)); chunk >= 1; chunk = Math.floor(chunk / 2)) {
        for (let at = 0; at < get(cur).length;) {
          const list = get(cur);
          const trial = set(cur, [...list.slice(0, at), ...list.slice(at + chunk)]);
          if (breaks(trial)) { cur = trial; progress = true; } else at += chunk;
        }
      }
    }
    if (cur.availability.maxDailyMinutesByDay) {
      const trial = { ...cur, availability: { ...cur.availability, maxDailyMinutesByDay: undefined } };
      if (breaks(trial)) { cur = trial; progress = true; }
    }
  }
  return cur;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const started = performance.now();

if (ONLY !== null) {
  console.log(`\n  sweep · seed ${SEED} · scenario ${ONLY}\n`);
  runScenario(ONLY, true);
} else {
  console.log(`\n  sweep · seed ${SEED} · ${SCENARIOS} scenarios\n`);
  for (let i = 0; i < SCENARIOS; i++) {
    runScenario(i, false);
    if ((i + 1) % 500 === 0) {
      const failed = [...findings.values()].reduce((t, f) => t + f.count, 0);
      console.log(`  ${i + 1} scenarios · ${plans} plans · ${failed} failures · ${warnings.length} warnings`);
    }
  }
}

timings.sort((a, b) => a - b);
const pct = (p: number) => timings[Math.min(timings.length - 1, Math.floor(timings.length * p))] ?? 0;
console.log(
  `\n  ${plans} plans in ${((performance.now() - started) / 1000).toFixed(0)}s · ` +
  `planner p50 ${pct(0.5).toFixed(1)}ms, p99 ${pct(0.99).toFixed(1)}ms, max ${pct(1).toFixed(1)}ms ` +
  `(--only ${slowest.scenario} --plan ${slowest.step})`,
);
console.log('  promises: a ceiling · b no overlaps, inside the day · c deadlines, no more than the work left · d session length · ' +
  'e commitment quota, daily limit, window · f deterministic, input untouched · h under 100ms · i unique ids · j reasons read');

if (findings.size === 0) {
  console.log('\n  ✔ every promise held\n');
} else {
  console.log(`\n  ✖ ${findings.size} promise(s) broken\n`);
  for (const [k, f] of [...findings.entries()].sort()) {
    console.log(`  ✖ ${k}  ×${f.count}`);
    console.log(`    first: --seed ${SEED} --only ${f.scenario}, plan ${f.step}`);
    console.log(`    ${f.violation.detail}`);
    if (ONLY === null && f.violation.inv !== 'f' && f.violation.inv !== 'h') {
      const small = reduce(f.input, k);
      const again = check(small, run(small)).find((v) => key(v) === k);
      console.log(`    reduced: ${small.assignments.length} assignments, ${small.options.commitments.length} commitments, ` +
        `${small.options.existingBlocks.length} kept blocks, ${small.options.events.length} events, ${small.availability.busy.length} busy`);
      console.log(`    ${again?.detail ?? ''}`);
      console.log(`    ${JSON.stringify(small)}`);
    }
    console.log();
  }
}

if (warnings.length > 0) {
  console.log(`  ${warnings.length} warning(s): a day with room left empty while work went unplanned`);
  const byReason = new Map<string, typeof warnings>();
  for (const w of warnings) {
    const reason = w.text.match(/unplanned: .*?\(([^)]*)\)/)?.[1] ?? 'other';
    byReason.set(reason, [...(byReason.get(reason) ?? []), w]);
  }
  for (const [reason, list] of byReason) {
    console.log(`    ${list.length} × ${reason}`);
    for (const w of list.slice(0, 3)) console.log(`      ! --only ${w.scenario} --plan ${w.step}: ${w.text}`);
  }
  console.log();
}

if (windowConflicts.count > 0) {
  console.log(`  ${windowConflicts.count} report(s) of a commitment whose window cannot hold one session`);
  console.log(`    ${windowConflicts.first}\n`);
}

process.exit(findings.size === 0 ? 0 : 1);
