/**
 * The scoring function.
 *
 * The roadmap's formula is
 *
 *   score = urgency × weight × decay × fit × (1 / confidence)
 *
 * and that shape is preserved here, with one change: every term is bounded.
 * An unbounded 1/confidence term means a single assignment a student rated 0.05
 * on swamps five real deadlines, and the schedule stops looking sane. Bounded
 * terms keep the ranking legible — which matters more than optimality, because
 * a student who can't see why a block is there stops trusting the whole thing.
 *
 * No LLM anywhere in this file. It runs in under a millisecond, returns the
 * same answer twice, and can be explained in a sentence to the person it's
 * scheduling for.
 */

import type { CommitmentCategory, EnergyPattern, StudyMethod, WorkKind } from '../types.ts';

/** How long an unbroken working session should be, per kind of work. */
export const SESSION_MINUTES: Record<WorkKind, number> = {
  exam: 45,
  quiz: 40,
  'problem set': 50,
  writing: 60,
  reading: 35,
  lab: 50,
  project: 75,
  discussion: 25,
  other: 45,
};

/** Never schedule a fragment shorter than this — it's not a study session, it's an interruption. */
export const MIN_SESSION_MINUTES = 25;

/**
 * How much focused attention the work demands, 0–1. Paired with the student's
 * energy curve to decide what belongs at 9am versus 9pm.
 */
export const DEMAND: Record<WorkKind, number> = {
  exam: 1.0,
  quiz: 0.8,
  'problem set': 0.9,
  writing: 0.85,
  lab: 0.6,
  project: 0.7,
  reading: 0.5,
  discussion: 0.3,
  other: 0.5,
};

/**
 * Characteristic ramp time in days — how far out the work starts feeling urgent.
 *
 * This is what makes spaced practice actually happen. With one shared ramp, an
 * exam ten days out scores below a discussion post due tomorrow, never gets
 * scheduled, and the product recreates the cramming it was built to prevent.
 * Giving exams a longer ramp keeps them warm early.
 */
const RAMP_DAYS: Record<WorkKind, number> = {
  exam: 6,
  project: 5,
  writing: 4,
  lab: 3,
  quiz: 3,
  'problem set': 2,
  reading: 2,
  discussion: 1.5,
  other: 2,
};

/** 1 (distant) → 5 (due now) → 6 (overdue). */
export function urgency(daysUntilDue: number, kind: WorkKind): number {
  if (daysUntilDue < 0) return 6;
  return 1 + 4 * Math.exp(-daysUntilDue / RAMP_DAYS[kind]);
}

/** 0.6 (a 1% discussion post) → 1.6 (a 40% final). */
export function weightFactor(weight: number): number {
  return 0.6 + 2.5 * clamp(weight, 0, 0.4);
}

/**
 * The spacing signal: work untouched for a while rises.
 *
 * Something never started sits deliberately above the middle — new work should
 * get going, but not outrank a course that's been neglected for a week.
 */
export function spacingFactor(lastTouched: string | null, now: Date): number {
  if (!lastTouched) return 1.4;
  const days = (now.getTime() - new Date(lastTouched).getTime()) / 86_400_000;
  return 1 + 0.8 * clamp(days / 10, 0, 1);
}

/** 0.67 (solid) → 1.67 (shaky). The roadmap's 1/confidence, bounded. */
export function confidenceFactor(confidence: number): number {
  return 1 / (0.5 + clamp(confidence, 0, 1));
}

/**
 * Available attention at a given local hour, 0–1.
 *
 * Deliberately coarse. A student who declares "evening person" wants their hard
 * work after dinner; the exact shape of the curve matters far less than
 * respecting that declaration visibly.
 */
export function energyAt(hour: number, pattern: EnergyPattern): number {
  const curves: Record<EnergyPattern, number[]> = {
    //         0    1    2    3    4    5    6    7    8    9   10   11
    morning: [0.1, 0.1, 0.1, 0.1, 0.1, 0.3, 0.6, 0.8, 1.0, 1.0, 1.0, 0.9,
    //        12   13   14   15   16   17   18   19   20   21   22   23
              0.7, 0.7, 0.8, 0.8, 0.7, 0.6, 0.5, 0.5, 0.4, 0.3, 0.2, 0.1],
    evening: [0.3, 0.2, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6,
              0.6, 0.6, 0.7, 0.7, 0.8, 0.8, 0.8, 0.9, 1.0, 1.0, 0.9, 0.7],
    steady:  [0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0, 1.0,
              0.8, 0.8, 0.9, 0.9, 0.9, 0.8, 0.7, 0.7, 0.7, 0.6, 0.4, 0.2],
    // Two peaks with a flat middle: sharp before the day starts, sharp again
    // after it ends. The shape of anyone whose middle hours belong to a job or
    // a class schedule, which is most people this is built for.
    bimodal: [0.1, 0.1, 0.1, 0.1, 0.1, 0.2, 0.7, 1.0, 1.0, 0.9, 0.7, 0.6,
              0.5, 0.5, 0.5, 0.5, 0.6, 0.8, 0.9, 1.0, 1.0, 0.95, 0.85, 0.6],
  };
  return curves[pattern][clamp(Math.floor(hour), 0, 23)];
}

/** 0.55 (demanding work at a dead hour) → 1.0 (well matched). */
export function fitAt(kind: WorkKind, hour: number, pattern: EnergyPattern): number {
  return fitForDemand(DEMAND[kind], hour, pattern);
}

/**
 * The same calculation for anything that carries its own cognitive load rather
 * than inheriting one from a work type. Recurring commitments set demand
 * directly: a run is physically hard and mentally cheap, and belongs in an hour
 * that reading a paper would waste.
 */
export function fitForDemand(demand: number, hour: number, pattern: EnergyPattern): number {
  return 1 - 0.45 * Math.abs(clamp(demand, 0, 1) - energyAt(hour, pattern));
}

export interface ScoreInput {
  kind: WorkKind;
  weight: number;
  confidence: number;
  lastTouched: string | null;
  dueAt: Date;
  slotStart: Date;
  energy: EnergyPattern;
  localHour: number;
  now: Date;
}

export interface ScoreBreakdown {
  score: number;
  urgency: number;
  weight: number;
  spacing: number;
  confidence: number;
  fit: number;
  /** Which term is doing the most work, relative to a neutral 1.0. */
  dominant: 'urgency' | 'weight' | 'spacing' | 'confidence' | 'fit';
}

export function scoreSlot(input: ScoreInput): ScoreBreakdown {
  const daysUntil = (input.dueAt.getTime() - input.slotStart.getTime()) / 86_400_000;

  const terms = {
    urgency: urgency(daysUntil, input.kind),
    weight: weightFactor(input.weight),
    spacing: spacingFactor(input.lastTouched, input.now),
    confidence: confidenceFactor(input.confidence),
    fit: fitAt(input.kind, input.localHour, input.energy),
  };

  const score = terms.urgency * terms.weight * terms.spacing * terms.confidence * terms.fit;

  // "Dominant" means furthest above neutral, not largest — otherwise urgency,
  // whose range is 1–6, would win every single time and the explanations would
  // all read the same.
  const spread: Record<string, number> = {
    urgency: terms.urgency / 5,
    weight: terms.weight / 1.6,
    spacing: terms.spacing / 1.8,
    confidence: terms.confidence / 1.67,
    fit: terms.fit / 1.0 - 0.4,   // fit is a modifier, rarely the headline
  };
  const dominant = (Object.keys(spread) as Array<keyof typeof spread>)
    .reduce((best, k) => (spread[k] > spread[best] ? k : best), 'urgency');

  return { score, ...terms, dominant: dominant as ScoreBreakdown['dominant'] };
}

/**
 * What the student should actually do in the block.
 *
 * Retrieval practice is the default for anything being learned rather than
 * produced — it's the best-supported study method there is. Note the honest
 * caveat from the research: the classroom effect is real but modest, so this is
 * a sensible default, not a promise about grades.
 */
export function methodFor(kind: WorkKind, sessionIndex: number, sessionCount: number): StudyMethod {
  switch (kind) {
    case 'exam':
    case 'quiz':
      return 'retrieval practice';
    case 'problem set':
      return 'practice problems';
    case 'writing':
      // The last third of a writing job is revision, not generation.
      return sessionIndex > Math.ceil(sessionCount * (2 / 3)) ? 'revising' : 'drafting';
    case 'reading':
      return 'active reading';
    case 'lab':
      return 'lab prep';
    case 'project':
      return 'build';
    default:
      return 'work session';
  }
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// ─── recurring commitments ─────────────────────────────────────────

/**
 * Pressure from falling behind a weekly quota.
 *
 * This replaces `urgency` for things with no deadline. Five runs with six days
 * left is relaxed; five runs with two days left is not. It rises as the ratio of
 * work remaining to days remaining grows, and returns to the floor once the
 * week's target is met.
 */
export function quotaPressure(remaining: number, daysLeftInWeek: number): number {
  if (remaining <= 0) return 0;
  const perDay = remaining / Math.max(daysLeftInWeek, 0.5);
  return 1 + 4 * clamp(perDay, 0, 1.25) / 1.25;
}

/** 0.6 (nice to have) → 1.6 (non-negotiable). Same range as weightFactor. */
export function importanceFactor(importance: number): number {
  return 0.6 + clamp(importance, 0, 1);
}

/**
 * Slot-independent rank for one session of a recurring commitment, on the same
 * scale as an assignment's priority so the two compete honestly for the same
 * hours. Coursework should not automatically outrank exercise, and exercise
 * should not automatically outrank an exam.
 */
export function commitmentPriority(
  input: { remaining: number; daysLeftInWeek: number; importance: number; lastDoneAt: string | null },
  now: Date,
): number {
  return (
    quotaPressure(input.remaining, input.daysLeftInWeek) *
    importanceFactor(input.importance) *
    spacingFactor(input.lastDoneAt, now)
  );
}

/** Default cognitive load per category, overridable per commitment. */
export const CATEGORY_DEMAND: Record<CommitmentCategory, number> = {
  fitness: 0.25,
  project: 0.85,
  learning: 0.8,
  personal: 0.35,
};

export const CATEGORY_METHOD: Record<CommitmentCategory, StudyMethod> = {
  fitness: 'work session',
  project: 'build',
  learning: 'active reading',
  personal: 'work session',
};
