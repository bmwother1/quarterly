import type { StudyBlock } from '../types.ts';
import { localParts } from '../time.ts';

/**
 * Telling "I skipped one thing" apart from "I was away".
 *
 * The app currently treats them identically: every planned block whose time has
 * passed becomes an unanswered block, so five days away opens the week with
 * fifteen of them in red and a request to adjudicate each one.
 *
 * That is the wrong ask, and it is wrong in the specific way this product is
 * supposed to be better at. From the competitive teardown, in students' own
 * words: planners punish imperfection, so a missed day ends the habit entirely.
 * Demanding an itemised account of last Tuesday before the app becomes useful
 * again is a toll gate, and it is charged at exactly the moment week-4 retention
 * is decided.
 *
 * **It is not a licence to forget.** "A missed block must never just vanish"
 * still holds. The difference is between telling a student what happened, which
 * is honest, and requiring them to itemise it before they can carry on, which is
 * bookkeeping dressed as honesty. After a real absence the app should say what
 * it saw, offer one action, and get out of the way.
 */

export type AbsenceKind = 'none' | 'lapse' | 'away';

export interface Absence {
  kind: AbsenceKind;
  /** Planned blocks whose time has passed. */
  blocks: StudyBlock[];
  /** Distinct local days those blocks fall on. */
  days: number;
  /** Local days between the oldest unanswered block and now. */
  daysSince: number;
}

/**
 * A lapse is something you can still remember. Two days is the boundary because
 * it is roughly where honest recall stops: a student can tell you about
 * yesterday morning and cannot tell you whether they ran on Tuesday last week,
 * so asking produces a guess and a guess is worse data than no data.
 */
const LAPSE_DAYS = 2;

export function absence(blocks: StudyBlock[], now: Date, tz: string): Absence {
  const missed = blocks
    .filter((b) => b.status === 'planned' && new Date(b.end) < now)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (missed.length === 0) {
    return { kind: 'none', blocks: [], days: 0, daysSince: 0 };
  }

  const dayKeys = new Set(missed.map((b) => localParts(new Date(b.start), tz).dateKey));
  const oldest = new Date(missed[0].start);

  // Whole local days, so an evening block missed last night reads as 1 rather
  // than as 0 because fewer than 24 hours have elapsed.
  const todayKey = localParts(now, tz).dateKey;
  const oldestKey = localParts(oldest, tz).dateKey;
  const daysSince = Math.round(
    (Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${oldestKey}T00:00:00Z`)) / 86_400_000,
  );

  // Either measure can trigger it. Fifteen blocks over two days is a bad
  // weekend and still answerable; three blocks spread over eight days is an
  // absence, even though there are fewer of them.
  const kind: AbsenceKind = daysSince > LAPSE_DAYS || dayKeys.size > LAPSE_DAYS ? 'away' : 'lapse';

  return { kind, blocks: missed, days: dayKeys.size, daysSince };
}

/**
 * Let go of everything that went unanswered, without claiming it was done.
 *
 * Returns the blocks marked `skipped`, which is the truth: the time passed and
 * nothing was recorded against it. No minutes are logged and no weekly tally
 * moves, so a week away cannot flatter the completion numbers that retention is
 * eventually judged on.
 *
 * Deliberately not `done`, and deliberately not deletion. One would be a lie and
 * the other would erase the evidence that the plan did not survive contact.
 */
export function releaseMissed(blocks: StudyBlock[], now: Date): StudyBlock[] {
  return blocks.map((b) =>
    b.status === 'planned' && new Date(b.end) < now
      ? { ...b, status: 'skipped' as const, actualMinutes: 0 }
      : b,
  );
}
