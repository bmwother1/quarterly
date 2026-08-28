/**
 * What the student actually does, as opposed to what they said they'd do.
 *
 * The energy pattern is currently a dropdown picked once during setup. Observed
 * completion rate by hour is strictly better evidence: people are poor
 * predictors of their own behaviour and excellent records of it. Every
 * check-off already logs the hour a block ran and whether it finished, so the
 * data has been accumulating since day one with nothing reading it.
 *
 * Nothing here uses a model. These are counts and ratios, so the result is
 * instant, identical every time, and incapable of inventing a pattern.
 */

import type { EnergyPattern, StudyBlock } from '../types.ts';
import { localParts } from '../time.ts';

/**
 * How many observations before the app is allowed to claim a pattern.
 *
 * A confidently wrong personalisation costs far more trust than generic copy
 * ever does. Three data points is noise; below this threshold the app says
 * nothing rather than something shaky.
 */
export const MIN_OBSERVATIONS = 8;

export interface HourStats {
  hour: number;
  attempted: number;
  completed: number;
  /** completed / attempted, or null when there isn't enough to say. */
  rate: number | null;
}

/** A block counts as attempted once it's been answered either way. */
function isSettled(b: StudyBlock): boolean {
  return b.status === 'done' || b.status === 'partial' || b.status === 'skipped';
}

function isCompleted(b: StudyBlock): boolean {
  return b.status === 'done' || b.status === 'partial';
}

export function hourStats(blocks: StudyBlock[], tz: string): HourStats[] {
  const attempted = new Array(24).fill(0);
  const completed = new Array(24).fill(0);

  for (const b of blocks) {
    if (!isSettled(b)) continue;
    const h = localParts(new Date(b.start), tz).hour;
    attempted[h] += 1;
    if (isCompleted(b)) completed[h] += 1;
  }

  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    attempted: attempted[hour],
    completed: completed[hour],
    rate: attempted[hour] > 0 ? completed[hour] / attempted[hour] : null,
  }));
}

/**
 * Which of the declared patterns the student's behaviour actually resembles.
 *
 * Returns null until there's enough evidence, and the caller keeps whatever the
 * student chose. Deliberately picks from the existing four rather than
 * synthesising a bespoke curve: a curve fitted to twenty observations would be
 * mostly noise, and the four shapes already cover the real cases.
 */
export function inferEnergyPattern(
  blocks: StudyBlock[],
  tz: string,
): { pattern: EnergyPattern; confidence: number; observations: number } | null {
  const stats = hourStats(blocks, tz);
  const total = stats.reduce((s, h) => s + h.attempted, 0);
  if (total < MIN_OBSERVATIONS) return null;

  // Completion rates in the two windows that separate the four patterns.
  const window = (from: number, to: number) => {
    const inRange = stats.filter((h) => h.hour >= from && h.hour < to);
    const a = inRange.reduce((s, h) => s + h.attempted, 0);
    const c = inRange.reduce((s, h) => s + h.completed, 0);
    return a > 0 ? { rate: c / a, n: a } : null;
  };

  const morning = window(5, 12);
  const midday = window(12, 17);
  const evening = window(17, 24);

  // Without both ends there's nothing to compare, so say nothing.
  if (!morning || !evening) return null;

  const gap = morning.rate - evening.rate;
  const middleDip = midday !== null && midday.rate < Math.min(morning.rate, evening.rate) - 0.15;

  let pattern: EnergyPattern;
  if (middleDip && Math.abs(gap) < 0.2) pattern = 'bimodal';
  else if (gap > 0.2) pattern = 'morning';
  else if (gap < -0.2) pattern = 'evening';
  else pattern = 'steady';

  // How separated the evidence is, capped. A 40-point gap is a clear signal; a
  // 5-point gap on nine observations is not.
  const confidence = Math.min(1, Math.abs(gap) * 2 + Math.min(total / 40, 0.5));
  return { pattern, confidence, observations: total };
}

/**
 * Hours the student reliably fails to finish, so the scheduler can stop using
 * them. Requires real evidence per hour, not just overall.
 */
export function deadHours(blocks: StudyBlock[], tz: string, minPerHour = 3): number[] {
  return hourStats(blocks, tz)
    .filter((h) => h.attempted >= minPerHour && h.rate !== null && h.rate <= 0.25)
    .map((h) => h.hour);
}

/**
 * How badly durations are underestimated, per course and work type.
 *
 * Reported rather than silently applied, because "your CHEM labs take twice as
 * long as you plan" is a genuinely useful thing to be told once.
 */
export function durationBias(
  blocks: StudyBlock[],
): Array<{ course: string; planned: number; actual: number; ratio: number; samples: number }> {
  const by = new Map<string, { planned: number; actual: number; samples: number }>();

  for (const b of blocks) {
    if (b.status !== 'done' || b.actualMinutes === null) continue;
    const cur = by.get(b.course) ?? { planned: 0, actual: 0, samples: 0 };
    cur.planned += b.minutes;
    cur.actual += b.actualMinutes;
    cur.samples += 1;
    by.set(b.course, cur);
  }

  return [...by]
    .filter(([, v]) => v.samples >= 3 && v.planned > 0)
    .map(([course, v]) => ({
      course,
      planned: v.planned,
      actual: v.actual,
      ratio: v.actual / v.planned,
      samples: v.samples,
    }))
    .filter((x) => x.ratio > 1.25 || x.ratio < 0.75)
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * How many observations before what a student does is allowed to overrule what
 * they said about themselves.
 *
 * Much higher than `MIN_OBSERVATIONS`, and the gap between the two is the whole
 * point. Eight is enough to *mention* a pattern in Insights, where the student
 * reads it and decides. It is nowhere near enough to silently reschedule their
 * week against a preference they stated on purpose: eight blocks is one bad
 * week, and one bad week is exactly when someone's real pattern looks worst.
 */
export const OVERRIDE_MIN_OBSERVATIONS = 24;

/** And the evidence has to actually separate, not merely lean. */
export const OVERRIDE_MIN_CONFIDENCE = 0.55;

export interface EffectiveEnergy {
  pattern: EnergyPattern;
  /** Which one the scheduler is using, and therefore what to say about it. */
  source: 'declared' | 'observed';
  observations: number;
  confidence: number;
}

/**
 * The energy pattern the scheduler should actually use.
 *
 * The app has been recording completion rate by hour since day one and then
 * scheduling against a dropdown, so it measured the truth and ignored it. This
 * closes that, but not unconditionally.
 *
 * **Three things must all hold before observation wins.** There has to be real
 * evidence, it has to separate clearly, and it has to disagree with what the
 * student said. Agreement is not an override, it is a coincidence, and calling
 * it one would put a needless "we changed this" notice in front of someone.
 *
 * **`energyLocked` always wins.** A student who has been told what their blocks
 * say and still chose otherwise has answered the question, and an app that
 * keeps overruling them is arguing rather than helping. Same reasoning as a
 * pinned block: a preference is a preference.
 *
 * Nothing here is a model. Counts and ratios, so it is instant, identical every
 * time, and incapable of inventing a pattern that is not in the data.
 */
export function effectiveEnergy(
  availability: { energy: EnergyPattern; energyLocked?: boolean },
  blocks: StudyBlock[],
  tz: string,
): EffectiveEnergy {
  const declared: EffectiveEnergy = {
    pattern: availability.energy,
    source: 'declared',
    observations: 0,
    confidence: 0,
  };

  if (availability.energyLocked) return declared;

  const inferred = inferEnergyPattern(blocks, tz);
  if (!inferred) return declared;

  declared.observations = inferred.observations;
  declared.confidence = inferred.confidence;

  if (inferred.observations < OVERRIDE_MIN_OBSERVATIONS) return declared;
  if (inferred.confidence < OVERRIDE_MIN_CONFIDENCE) return declared;
  if (inferred.pattern === availability.energy) return declared;

  return {
    pattern: inferred.pattern,
    source: 'observed',
    observations: inferred.observations,
    confidence: inferred.confidence,
  };
}
