/**
 * The planner.
 *
 * Takes the student's deadlines and their open time, and returns a week of
 * study blocks. Deterministic, sub-100ms, no LLM anywhere in the path — a
 * schedule that reshuffles itself on every refresh is one students stop
 * trusting, and one that takes two seconds to compute is one they stop opening.
 *
 * ── Why tasks pick slots, not the other way round ──────────────────
 *
 * The obvious implementation walks time forward and, at each opening, drops in
 * whatever scores highest. It's simpler, and it's wrong in a way that quietly
 * guts the product: the energy-fit term can only ever break ties between tasks
 * competing for the same slot, so it never actually moves work to a better hour.
 * A student who tells the app they're useless before noon still gets exam prep
 * at 8am, because at 8am the exam is the highest-scoring thing available.
 *
 * So the loop is inverted. Work is ranked once, by everything that doesn't
 * depend on when it happens — deadline pressure, grade weight, neglect,
 * shakiness — and then each piece, in that order, picks the best hour still
 * open to it. Fit finally has somewhere to bite.
 *
 * ── Two commitments ────────────────────────────────────────────────
 *
 *   1. It refuses to lie about capacity. Work that doesn't fit comes back in
 *      `unscheduled` with a reason rather than being crammed into hours the
 *      student said they were asleep. Silently overbooking is precisely what
 *      makes people quit a planner in week 4.
 *
 *   2. Every block carries its own justification, generated from whichever
 *      scoring term actually dominated — a real account of the ranking, not
 *      decoration.
 */

import type { Assignment, Availability, Commitment, StudyBlock, WorkKind } from '../types.ts';
import { DEFAULT_TZ, localParts, weekdayOf, zonedInstant } from '../time.ts';
import { freeMinutesByDay, freeSlots } from './slots.ts';
import {
  CATEGORY_METHOD,
  MIN_SESSION_MINUTES,
  SESSION_MINUTES,
  DEMAND,
  commitmentPriority,
  confidenceFactor,
  fitForDemand,
  methodFor,
  scoreSlot,
  spacingFactor,
  urgency,
  weightFactor,
  clamp,
  type ScoreBreakdown,
} from './score.ts';

export interface PlanOptions {
  now?: Date;
  /** How many days forward to plan. One week is the unit students actually think in. */
  days?: number;
  tz?: string;
  /** Share of each day's free time deliberately left empty. Life happens. */
  bufferFraction?: number;
  maxConsecutiveCourseMinutes?: number;
  breakMinutes?: number;
  maxSessionsPerAssignment?: number;
  /** Longest single session, whatever the arithmetic suggests. */
  maxSessionMinutes?: number;
  /**
   * How strongly to prefer sooner over better-suited, per day of delay.
   *
   * Without it, every task waits for its perfect hour and the week back-loads
   * into Friday night. At 0.35 a slot a day later is worth about three-quarters
   * as much, so a genuinely better hour later today wins but a marginally
   * better hour on Thursday does not.
   */
  earlyBiasPerDay?: number;
  /**
   * Whether deadlines that have already passed compete for time.
   *
   * Off by default, and that default matters. A Canvas feed carries 30 days of
   * history and says nothing about what was submitted, so most past-due items
   * are simply finished. Scheduling them anyway — at the maximum urgency score,
   * no less — buries a student's actual week under work they already handed in.
   * They come back in `overdue` instead, for the student to confirm.
   */
  includeOverdue?: boolean;
  /** Recurring weekly quotas: runs, project hours, a course to get through. */
  commitments?: Commitment[];
}

export interface UnscheduledItem {
  /** Set for coursework; null for a recurring commitment that fell short. */
  assignmentId: string | null;
  commitmentId: string | null;
  title: string;
  course: string;
  minutes: number;
  /** For commitments: how many of the week's target sessions went unplaced. */
  sessionsShort?: number;
  reason: 'not enough time before the deadline' | 'no room left this week';
}

export interface PlanResult {
  blocks: StudyBlock[];
  unscheduled: UnscheduledItem[];
  /**
   * Deadlines that passed and weren't marked done. Not scheduled — surfaced, so
   * the student can say which they still owe. See `includeOverdue`.
   */
  overdue: Assignment[];
  stats: {
    scheduledMinutes: number;
    freeMinutes: number;
    /** Free minutes minus the buffer — what was actually available to fill. */
    usableMinutes: number;
    blockCount: number;
    daysPlanned: number;
  };
}

/**
 * One schedulable session, from either source.
 *
 * Coursework and recurring commitments land in the same queue deliberately.
 * They compete on one priority scale, so a run doesn't automatically lose to a
 * problem set and an exam doesn't automatically lose to a gym habit. Keeping
 * them in separate passes was the alternative, and it always ends with one
 * category quietly eating all the good hours.
 */
interface Pending {
  /** Stable prefix for the resulting block id. */
  key: string;
  title: string;
  /** Display grouping: a course code, or the commitment's own name. */
  group: string;
  kind: WorkKind;
  /** Cognitive load for energy fit. From the work type, or set by the commitment. */
  demand: number;
  index: number;      // 1-based
  count: number;
  minutes: number;
  dueAt: Date;
  /** Deadline used for placement. Differs from `dueAt` only for overdue work. */
  placeBy: Date;
  /** Slot-independent rank: how much this deserves time at all, before asking when. */
  priority: number;
  /** Sessions must land on separate days: exams, and anything done once a day. */
  separateDays: boolean;
  /** Shortest session worth placing. Below this, report short instead. */
  minMinutes: number;
  /** Reserved after the block and not part of it: shower, pack-up, travel. */
  bufferAfterMinutes: number;
  /** Hard local-time window, minutes after midnight. Null means anytime. */
  windowStartMin: number | null;
  windowEndMin: number | null;
  assignment: Assignment | null;
  commitment: Commitment | null;
  placed: StudyBlock | null;
}

/**
 * A contiguous run of open time, split as blocks are placed into it.
 *
 * Held as epoch milliseconds rather than `Date`s, with the local start hour
 * carried alongside. The inner loop touches these tens of thousands of times
 * and `Intl` formatting — which is what resolving a local hour costs — is far
 * and away the most expensive thing in the planner.
 */
interface Opening {
  dateKey: string;
  startMs: number;
  endMs: number;
  startHour: number;
  /** Local minutes after midnight, for hard time-window constraints. */
  startMinuteOfDay: number;
}

/** One placed block, reduced to the three numbers the adjacency check needs. */
interface Span {
  startMs: number;
  endMs: number;
  minutes: number;
}

const DEFAULTS: Required<PlanOptions> = {
  now: new Date(),
  days: 7,
  tz: DEFAULT_TZ,
  bufferFraction: 0.2,
  maxConsecutiveCourseMinutes: 120,
  breakMinutes: 15,
  maxSessionsPerAssignment: 8,
  maxSessionMinutes: 90,
  earlyBiasPerDay: 0.35,
  includeOverdue: false,
  commitments: [],
};

/**
 * When the work is actually due, as an instant.
 *
 * Canvas all-day items carry no time, and treating them as due at midnight
 * *starting* that day silently removes a full day of runway from every one of
 * them. They're due at the end of the day, so that's what we use.
 */
export function dueInstant(a: Assignment, tz: string): Date {
  if (!a.allDay) return new Date(a.due);
  const p = localParts(new Date(a.due), tz);
  return new Date(new Date(a.due).getTime() + (23 * 60 + 59 - p.minutesOfDay) * 60_000);
}

/** Break an assignment's remaining work into sessions of a sane length. */
function buildSessions(a: Assignment, opts: Required<PlanOptions>): Pending[] {
  const remaining = Math.max(0, a.estimatedMinutes - a.actualMinutes);
  if (remaining < MIN_SESSION_MINUTES / 2) return [];

  const preferred = SESSION_MINUTES[a.kind];
  const count = clamp(Math.ceil(remaining / preferred), 1, opts.maxSessionsPerAssignment);
  const per = clamp(
    Math.round(remaining / count / 5) * 5,
    Math.min(MIN_SESSION_MINUTES, remaining),
    opts.maxSessionMinutes,
  );

  const dueAt = dueInstant(a, opts.tz);
  // Overdue work still deserves a slot — it just no longer has a real deadline
  // to schedule against, so we give it a short artificial runway.
  const placeBy = dueAt > opts.now ? dueAt : new Date(opts.now.getTime() + 3 * 86_400_000);

  // Everything here is independent of *when* the session lands. The hour-
  // dependent part (fit) is applied later, when this session picks its slot.
  const daysUntil = (dueAt.getTime() - opts.now.getTime()) / 86_400_000;
  const priority =
    urgency(daysUntil, a.kind) *
    weightFactor(a.weight) *
    spacingFactor(a.lastTouched, opts.now) *
    confidenceFactor(a.confidence);

  return Array.from({ length: count }, (_, i) => ({
    key: a.id,
    title: a.title,
    group: a.course,
    kind: a.kind,
    demand: DEMAND[a.kind],
    assignment: a,
    commitment: null,
    index: i + 1,
    count,
    minutes: per,
    dueAt,
    placeBy,
    priority,
    // Spacing exam prep across days is the entire point of spacing it.
    separateDays: a.kind === 'exam' || a.kind === 'quiz',
    // Coursework is happy to be trimmed: partial progress beats none.
    minMinutes: MIN_SESSION_MINUTES,
    bufferAfterMinutes: 0,
    windowStartMin: null,
    windowEndMin: null,
    placed: null,
  }));
}

/**
 * Sessions for one recurring commitment, for the remainder of the current week.
 *
 * The quota resets weekly, so the horizon here is the end of the week rather
 * than the full planning window. Scheduling next week's runs today would be
 * both wrong and demoralising.
 */
function buildCommitmentSessions(c: Commitment, opts: Required<PlanOptions>): Pending[] {
  if (!c.active) return [];

  const remaining = Math.max(0, c.sessionsPerWeek - c.doneThisWeek);
  if (remaining === 0) return [];

  // Days left in the week, counting today. Monday-anchored.
  const today = localParts(opts.now, opts.tz);
  const daysLeftInWeek = 7 - today.weekday;
  const endOfWeek = zonedInstant(addDaysKey(today.dateKey, daysLeftInWeek - 1), 23 * 60 + 59, opts.tz);

  // Don't plan beyond the requested horizon either.
  const horizonEnd = new Date(opts.now.getTime() + opts.days * 86_400_000);
  const placeBy = endOfWeek < horizonEnd ? endOfWeek : horizonEnd;

  const priority = commitmentPriority(
    { remaining, daysLeftInWeek, importance: c.importance, lastDoneAt: c.lastDoneAt },
    opts.now,
  );

  const minutes = clamp(c.minutesPerSession, MIN_SESSION_MINUTES, opts.maxSessionMinutes);

  return Array.from({ length: remaining }, (_, i) => ({
    key: c.id,
    title: c.title,
    group: c.title,
    kind: 'other' as WorkKind,
    demand: c.demand,
    assignment: null,
    commitment: c,
    index: i + 1,
    count: remaining,
    minutes,
    dueAt: placeBy,
    placeBy,
    priority,
    // A "five times a week" habit means five days, not five sessions on Sunday.
    separateDays: c.maxPerDay <= 1,
    minMinutes: clamp(c.minSessionMinutes || MIN_SESSION_MINUTES, MIN_SESSION_MINUTES, minutes),
    bufferAfterMinutes: Math.max(0, c.bufferAfterMinutes ?? 0),
    windowStartMin: c.windowStartMin,
    windowEndMin: c.windowEndMin,
    placed: null,
  }));
}

/** YYYY-MM-DD plus n days. Local to this module to avoid a circular import. */
function addDaysKey(dateKey: string, n: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Half an hour of daylight between two blocks is enough to reset the clock. */
const CHAIN_GAP_MS = 30 * 60_000;

/**
 * Contiguous same-course minutes running through a proposed placement.
 *
 * Both directions matter. Blocks are no longer placed in chronological order,
 * so a later placement can land *before* an existing one — checking only
 * backwards would let two hours of CHEM sneak in ahead of an already-scheduled
 * CHEM block and quietly blow the cap.
 *
 * `spans` holds only this course's blocks, sorted by start, so both walks stop
 * after a step or two instead of rescanning the whole schedule.
 */
function contiguousCourseMinutes(spans: Span[], startMs: number, endMs: number, minutes: number): number {
  let total = minutes;

  let cursor = startMs;
  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i];
    if (s.endMs > cursor) continue;              // sits after us; not part of the run behind
    if (cursor - s.endMs > CHAIN_GAP_MS) break;
    total += s.minutes;
    cursor = s.startMs;
  }

  cursor = endMs;
  for (const s of spans) {
    if (s.startMs < cursor) continue;            // sits before us
    if (s.startMs - cursor > CHAIN_GAP_MS) break;
    total += s.minutes;
    cursor = s.endMs;
  }

  return total;
}

/** Keep a course's spans ordered by start so the walks above can stop early. */
function insertSpan(spans: Span[], span: Span): void {
  let i = spans.length;
  while (i > 0 && spans[i - 1].startMs > span.startMs) i--;
  spans.splice(i, 0, span);
}

export function planWeek(
  assignments: Assignment[],
  availability: Availability,
  options: PlanOptions = {},
): PlanResult {
  const opts = { ...DEFAULTS, ...options };
  const { tz, now } = opts;

  const slots = freeSlots(availability, now, opts.days, tz, MIN_SESSION_MINUTES);
  const freeByDay = freeMinutesByDay(slots);

  // The buffer applies per day, not to the week as a whole. A week that's 80%
  // full on average but 100% full on Tuesday is a week that breaks Tuesday.
  const dailyCap = (dateKey: string): number => {
    const perDay = availability.maxDailyMinutesByDay?.[weekdayOf(dateKey)];
    return perDay ?? availability.maxDailyMinutes;
  };

  const capacity = new Map<string, number>();
  const capacityTotal = new Map<string, number>();
  for (const [dateKey, minutes] of freeByDay) {
    const usable = Math.min(dailyCap(dateKey), Math.floor(minutes * (1 - opts.bufferFraction)));
    capacity.set(dateKey, usable);
    capacityTotal.set(dateKey, usable);
  }

  const horizonEnd = now.getTime() + (opts.days + 30) * 86_400_000;
  const live = assignments.filter((a) => a.status === 'todo' && new Date(a.due).getTime() < horizonEnd);

  const overdue = live.filter((a) => dueInstant(a, tz).getTime() < now.getTime());
  const pending = [
    ...(opts.includeOverdue ? live : live.filter((a) => !overdue.includes(a)))
      .flatMap((a) => buildSessions(a, opts)),
    // Recurring quotas join the same queue and compete on the same scale.
    ...opts.commitments.flatMap((c) => buildCommitmentSessions(c, opts)),
  ];

  const siblingsOf = new Map<string, Pending[]>();
  for (const p of pending) {
    const list = siblingsOf.get(p.key);
    if (list) list.push(p);
    else siblingsOf.set(p.key, [p]);
  }

  // Highest priority picks its hour first. Ties broken by deadline then id, so
  // the same input always produces byte-identical output.
  const order = [...pending].sort((a, b) =>
    b.priority - a.priority ||
    a.dueAt.getTime() - b.dueAt.getTime() ||
    a.key.localeCompare(b.key) ||
    a.index - b.index,
  );

  let openings: Opening[] = slots.map((s) => {
    const p = localParts(s.start, tz);
    return {
      dateKey: s.dateKey,
      startMs: s.start.getTime(),
      endMs: s.end.getTime(),
      startHour: p.hour,
      startMinuteOfDay: p.minutesOfDay,
    };
  });

  // Every hour boundary in the horizon, resolved once. Fit only varies by the
  // hour, so these are the only start times worth considering — and computing
  // them up front keeps `Intl` out of the inner loop entirely.
  const hourGrid = new Map<string, Array<{ ms: number; hour: number; minuteOfDay: number }>>();
  for (const dateKey of new Set(openings.map((o) => o.dateKey))) {
    hourGrid.set(
      dateKey,
      Array.from({ length: 24 }, (_, h) => ({
        ms: zonedInstant(dateKey, h * 60, tz).getTime(),
        hour: h,
        minuteOfDay: h * 60,
      })),
    );
  }

  const blocks: StudyBlock[] = [];
  const spansByCourse = new Map<string, Span[]>();
  const nowMs = now.getTime();
  const breakMs = opts.breakMinutes * 60_000;

  for (const p of order) {
    if (p.placed) continue;

    const siblings = siblingsOf.get(p.key)!;

    // Sessions of one assignment run in order, so this one starts after the
    // previous one finished. Sessions are visited in index order because
    // priority is shared across siblings and `index` is the final tiebreak.
    const previous = siblings.find((q) => q.index === p.index - 1);
    if (previous && !previous.placed) continue;
    const earliestMs = previous?.placed
      ? new Date(previous.placed.end).getTime() + breakMs
      : nowMs;

    const spaced = p.separateDays;
    const usedDays = new Set(
      siblings.filter((q) => q.placed).map((q) => localParts(new Date(q.placed!.start), tz).dateKey),
    );

    const spans = spansByCourse.get(p.group) ?? [];
    const placeByMs = p.placeBy.getTime();

    let best: { openingIndex: number; startMs: number; hour: number; minutes: number; value: number } | null = null;

    for (let i = 0; i < openings.length; i++) {
      const o = openings[i];
      if (o.endMs <= earliestMs) continue;
      if (spaced && usedDays.has(o.dateKey)) continue;

      const dayLeft = capacity.get(o.dateKey) ?? 0;
      if (dayLeft < MIN_SESSION_MINUTES) continue;

      // Trimming is fine for coursework and wrong for a project that needs an
      // hour just to get somewhere. Each session declares its own floor.
      const minutes = Math.min(p.minutes, dayLeft);
      if (minutes < Math.min(p.minMinutes, p.minutes)) continue;
      const durationMs = minutes * 60_000;
      // The buffer is real time even though it isn't part of the block.
      const holdMs = durationMs + p.bufferAfterMinutes * 60_000;

      // The opening's own start, then each hour boundary inside it.
      const grid = hourGrid.get(o.dateKey)!;
      const candidates: Array<{ ms: number; hour: number; minuteOfDay: number }> = [
        { ms: o.startMs, hour: o.startHour, minuteOfDay: o.startMinuteOfDay },
      ];
      for (const g of grid) {
        if (g.ms <= o.startMs) continue;
        if (g.ms + holdMs > o.endMs) break;
        candidates.push(g);
      }

      // How much of this day is still free, 0-1. Used to push work off a day
      // that's already stacked and onto one that's genuinely open.
      const dayTotal = capacityTotal.get(o.dateKey) ?? 1;
      const openness = dayTotal > 0 ? dayLeft / dayTotal : 0;

      for (const c of candidates) {
        if (c.ms < earliestMs) continue;
        const endMs = c.ms + durationMs;
        if (c.ms + holdMs > o.endMs) continue;
        if (endMs > placeByMs) continue;

        // Hard local-time window, where one exists. The scoring function has no
        // concept of "don't run right before bed", so this is a filter, not a term.
        if (p.windowStartMin !== null && c.minuteOfDay < p.windowStartMin) continue;
        if (p.windowEndMin !== null && c.minuteOfDay + minutes + p.bufferAfterMinutes > p.windowEndMin) continue;

        if (contiguousCourseMinutes(spans, c.ms, endMs, minutes) > opts.maxConsecutiveCourseMinutes) continue;

        const fit = fitForDemand(p.demand, c.hour, availability.energy);
        const daysOut = Math.max(0, (c.ms - nowMs) / 86_400_000);

        // Three pulls, balanced: the right hour, sooner rather than later, and
        // a day that isn't already full. Without the third, everything stacks
        // onto the next two days and a wide-open Saturday sits empty.
        const value = fit * (0.45 + 0.55 * openness) / (1 + daysOut * opts.earlyBiasPerDay);

        if (!best || value > best.value + 1e-9) {
          best = { openingIndex: i, startMs: c.ms, hour: c.hour, minutes, value };
        }
      }
    }

    if (!best) continue;

    const { openingIndex, startMs, hour, minutes } = best;
    const endMs = startMs + minutes * 60_000;
    const method = p.commitment
      ? CATEGORY_METHOD[p.commitment.category]
      : methodFor(p.kind, p.index, p.count);

    // Only coursework has a deadline, a grade weight, and a confidence rating,
    // so the full breakdown is only meaningful there. A commitment's "why" comes
    // from its quota instead.
    const breakdown: ScoreBreakdown | null = p.assignment
      ? scoreSlot({
          kind: p.assignment.kind,
          weight: p.assignment.weight,
          confidence: p.assignment.confidence,
          lastTouched: p.assignment.lastTouched,
          dueAt: p.dueAt,
          slotStart: new Date(startMs),
          energy: availability.energy,
          localHour: hour,
          now,
        })
      : null;

    const block: StudyBlock = {
      id: `${p.key}::${p.index}`,
      assignmentId: p.assignment?.id ?? null,
      commitmentId: p.commitment?.id ?? null,
      course: p.group,
      title: p.title,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      minutes,
      method,
      why: explain(p, breakdown, method, now, tz),
      sessionIndex: p.index,
      sessionCount: p.count,
      status: 'planned',
      actualMinutes: null,
    };

    blocks.push(block);
    p.placed = block;

    insertSpan(spans, { startMs, endMs, minutes });
    spansByCourse.set(p.group, spans);

    const dateKey = openings[openingIndex].dateKey;
    // The buffer costs the day real time even though the block doesn't show it.
    capacity.set(dateKey, (capacity.get(dateKey) ?? 0) - minutes - p.bufferAfterMinutes);
    openings = splitOpening(
      openings, openingIndex, startMs, endMs + p.bufferAfterMinutes * 60_000, breakMs, tz,
    );
  }

  // Report what didn't fit, and why, rather than pretending the week is fine.
  const leftovers = new Map<string, UnscheduledItem>();
  for (const p of pending) {
    if (p.placed) continue;
    const reason: UnscheduledItem['reason'] =
      p.placeBy.getTime() < now.getTime() + opts.days * 86_400_000
        ? 'not enough time before the deadline'
        : 'no room left this week';

    const existing = leftovers.get(p.key);
    if (existing) {
      existing.minutes += p.minutes;
      if (p.commitment) existing.sessionsShort = (existing.sessionsShort ?? 0) + 1;
    } else {
      leftovers.set(p.key, {
        assignmentId: p.assignment?.id ?? null,
        commitmentId: p.commitment?.id ?? null,
        title: p.title,
        course: p.group,
        minutes: p.minutes,
        sessionsShort: p.commitment ? 1 : undefined,
        reason,
      });
    }
  }

  const freeMinutes = [...freeByDay.values()].reduce((s, m) => s + m, 0);
  const usableMinutes = [...capacityTotal.values()].reduce((s, m) => s + m, 0);

  return {
    blocks: blocks.sort((a, b) => a.start.localeCompare(b.start)),
    unscheduled: [...leftovers.values()],
    overdue,
    stats: {
      scheduledMinutes: blocks.reduce((s, b) => s + b.minutes, 0),
      freeMinutes,
      usableMinutes,
      blockCount: blocks.length,
      daysPlanned: freeByDay.size,
    },
  };
}

/**
 * Carve a placed block out of its opening, leaving a break's worth of air on
 * either side so two blocks can never end up shoulder to shoulder. Remainders
 * too short to hold a real session are dropped rather than kept as clutter.
 */
function splitOpening(
  openings: Opening[],
  index: number,
  startMs: number,
  endMs: number,
  padMs: number,
  tz: string,
): Opening[] {
  const target = openings[index];
  const replacements: Opening[] = [];

  const leftEnd = startMs - padMs;
  if ((leftEnd - target.startMs) / 60_000 >= MIN_SESSION_MINUTES) {
    replacements.push({ ...target, endMs: leftEnd });
  }

  const rightStart = endMs + padMs;
  if ((target.endMs - rightStart) / 60_000 >= MIN_SESSION_MINUTES) {
    replacements.push({
      dateKey: target.dateKey,
      startMs: rightStart,
      endMs: target.endMs,
      startHour: localParts(new Date(rightStart), tz).hour,
      startMinuteOfDay: localParts(new Date(rightStart), tz).minutesOfDay,
    });
  }

  return [...openings.slice(0, index), ...replacements, ...openings.slice(index + 1)];
}

// ─── explanations ──────────────────────────────────────────────────

function relativeDue(dueAt: Date, now: Date, tz: string): string {
  const hours = (dueAt.getTime() - now.getTime()) / 3_600_000;
  if (hours < 0) return 'past due';
  if (hours < 24) return `due in ${Math.max(1, Math.round(hours))} hours`;

  const days = Math.round(hours / 24);
  if (days === 1) return 'due tomorrow';
  if (days <= 6) return `due ${dueAt.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' })}`;
  return `due in ${days} days`;
}

const KIND_NOUN: Record<WorkKind, string> = {
  exam: 'exam',
  quiz: 'quiz',
  'problem set': 'problem set',
  writing: 'piece of writing',
  reading: 'reading',
  lab: 'lab',
  project: 'project',
  discussion: 'post',
  other: 'assignment',
};

/**
 * One sentence explaining the block.
 *
 * For coursework it's built from whichever scoring term actually dominated. For
 * a recurring commitment there is no deadline to appeal to, so the reason is the
 * quota: how many are left and how much week is left to do them in.
 *
 * Generated, not written by an LLM: it has to be instant, identical on every
 * re-plan, and incapable of inventing a reason.
 */
function explain(
  p: Pending,
  breakdown: ScoreBreakdown | null,
  method: string,
  now: Date,
  tz: string,
): string {
  if (p.commitment) return explainCommitment(p, now, tz);

  const a = p.assignment!;
  const when = relativeDue(p.dueAt, now, tz);
  const session = p.count > 1 ? `Session ${p.index} of ${p.count} — ` : '';

  if (p.dueAt < now) return 'Past due. Worth clearing before it starts costing you elsewhere.';

  switch (breakdown!.dominant) {
    case 'urgency':
      return `${session}${when}, and this is the last comfortable slot for it.`;

    case 'weight':
      return `${session}this ${KIND_NOUN[a.kind]} is worth about ${Math.round(a.weight * 100)}% of your ${a.course} grade.`;

    case 'spacing':
      return a.lastTouched
        ? `${session}you haven't touched ${a.course} in ${Math.round(
            (now.getTime() - new Date(a.lastTouched).getTime()) / 86_400_000,
          )} days — spacing it out is what makes it stick.`
        : `${session}you haven't started this yet and it's ${when}.`;

    case 'confidence':
      return `${session}you marked this one shaky, so ${method} first — testing yourself finds the gaps faster than rereading.`;

    case 'fit':
      return `${session}this needs real focus and this is one of your sharper hours.`;
  }
}

/** The quota story: what's left of this week's target, and how much week is left. */
function explainCommitment(p: Pending, now: Date, tz: string): string {
  const c = p.commitment!;
  const done = c.doneThisWeek;
  const target = c.sessionsPerWeek;
  const daysLeft = 7 - localParts(now, tz).weekday;
  const remainingAfter = target - done - p.index;

  if (c.lastDoneAt) {
    const since = Math.round((now.getTime() - new Date(c.lastDoneAt).getTime()) / 86_400_000);
    if (since >= 3) {
      return `${done + p.index} of ${target} this week — it's been ${since} days since the last one.`;
    }
  }

  if (remainingAfter > 0 && remainingAfter >= daysLeft - 1) {
    return `${done + p.index} of ${target} this week, and only ${daysLeft} days left to fit the rest.`;
  }

  return `${done + p.index} of ${target} this week.`;
}
