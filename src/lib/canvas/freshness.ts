/**
 * How old a student's Canvas deadlines are, and what to do about it.
 *
 * The decay this answers is the quiet one. Instructors publish all quarter, and
 * plenty of them post an assignment the same week it is due. A plan built on
 * Monday's deadline set can be wrong by Wednesday, and nothing looks wrong: the
 * week renders, the blocks are sensible, and the problem set posted on Tuesday
 * simply isn't in it.
 *
 * Pure functions of timestamps and a boolean, so the rules can be read and
 * tested without a browser.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * With a remembered link, Canvas is fetched once a day, on open.
 *
 * Twenty hours rather than twenty-four, because a student who opens the app at
 * 8am every day would otherwise land a few minutes short of a full day on most
 * mornings and only refresh every other day.
 */
export const AUTO_REFRESH_AFTER_HOURS = 20;

/**
 * Only shown with a remembered link when the daily fetch has been failing, so
 * it means "something is wrong with your link", not "please do a chore".
 */
export const REFRESH_PROMPT_AFTER_DAYS = 2;

/**
 * Without a remembered link, updating costs a trip back to Canvas. Three days,
 * because instructors who post the week of the deadline make a week-old import
 * genuinely wrong, and because the prompt is also the moment to offer
 * remembering the link so it never has to be asked again.
 */
export const REPASTE_AFTER_DAYS = 3;

export type FeedPrompt =
  | { kind: 'none' }
  /** The link is remembered but the daily fetch keeps failing. */
  | { kind: 'refresh'; days: number }
  /** Nothing is remembered, so updating costs a paste. */
  | { kind: 'repaste'; days: number };

export function daysSince(iso: string, now: Date): number {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.floor((now.getTime() - then) / DAY_MS);
}

/**
 * Whether any remembered calendar is due its daily fetch.
 *
 * Per link, from when this device last fetched it, so a Canvas link and a work
 * schedule remembered on different days both stay on a daily rhythm. A link with
 * no fetch time is due: its age is unknown, which is the case most worth
 * checking.
 */
export function dueForRefresh(feeds: ReadonlyArray<{ fetchedAt: string | null }>, now: Date): boolean {
  return feeds.some((f) => {
    if (!f.fetchedAt) return true;
    const then = Date.parse(f.fetchedAt);
    if (Number.isNaN(then)) return true;
    return now.getTime() - then >= AUTO_REFRESH_AFTER_HOURS * HOUR_MS;
  });
}

export function feedPrompt(opts: {
  /** When Canvas was last actually fetched. Not `lastSyncedAt`, which is the account. */
  canvasSyncedAt: string | null | undefined;
  remembered: boolean;
  /** Whether there is any Canvas data to be stale in the first place. */
  hasCourses: boolean;
  now: Date;
}): FeedPrompt {
  // Nothing imported yet is a setup question, and `SetupPrompt` already owns it.
  // Two banners telling a student to go to /import is one banner too many.
  if (!opts.hasCourses || !opts.canvasSyncedAt) return { kind: 'none' };

  const days = daysSince(opts.canvasSyncedAt, opts.now);

  if (opts.remembered) {
    return days >= REFRESH_PROMPT_AFTER_DAYS ? { kind: 'refresh', days } : { kind: 'none' };
  }
  return days >= REPASTE_AFTER_DAYS ? { kind: 'repaste', days } : { kind: 'none' };
}
