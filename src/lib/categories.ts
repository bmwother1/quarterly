/**
 * What kind of thing an hour is, and what colour that makes it.
 *
 * Colour used to be decorative: every course, commitment and event got the next
 * entry from one of five separate arrays, all doing `arr[i % arr.length]`, all
 * defined in a different file. Two things followed. A colour meant nothing on
 * its own, because the same red was a lecture in one week and a gym session in
 * another. And five copies of the same idea is how the feed-url bug happened:
 * fix one, miss four.
 *
 * Now there are two axes and they answer different questions.
 *
 *   **Category** answers "what kind of hour is this". It owns the hue family and
 *   is the only thing the month view reads, because at one bar per day there is
 *   nothing else to go on.
 *
 *   **Shade** answers "which course". It steps within the family, and it is a
 *   scanning aid rather than an identifier: every block carries its label, and
 *   the rule since the last palette is that colour is never the only encoding.
 *
 * **Nothing here stores a hex.** Entities store a category and a shade index,
 * and rendering resolves to a CSS custom property. Storing hex is what made
 * dark mode a second palette to keep in sync, and it meant a colour chosen in
 * August was still on screen after the palette was replaced.
 *
 * The values behind these variables are generated and validated by
 * `scripts/check-palette.ts`, not chosen by eye. The last palette was chosen by
 * eye and put two courses at ΔE 4.9 under deuteranopia, which is roughly one man
 * in twelve unable to tell them apart.
 */

export type Category = 'deadline' | 'class' | 'work' | 'focus' | 'personal' | 'sleep';

/** Fixed order. Used for stable iteration and for the legend. */
export const CATEGORIES: Category[] = [
  'deadline', 'class', 'work', 'focus', 'personal', 'sleep',
];

export interface CategoryMeta {
  label: string;
  /** Said to a student, in a picker. Not a definition. */
  hint: string;
  /**
   * How many distinct entities this category realistically holds.
   *
   * Only `deadline` and `class` hold one per course, so only they need four
   * steps. Validating four shades for all six would mean checking 24 colours to
   * solve a problem that exists in 8 of them.
   */
  shades: number;
  /** Time the student chose to spend, versus time already spoken for. */
  chosen: boolean;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  deadline: { label: 'Coursework', hint: 'Assignments, problem sets, exams', shades: 4, chosen: true },
  class:    { label: 'Classes',    hint: 'Lectures, labs, sections',         shades: 4, chosen: false },
  work:     { label: 'Work',       hint: 'Shifts and anything you are paid for', shades: 2, chosen: false },
  focus:    { label: 'Focus',      hint: 'Projects and study you set yourself',  shades: 2, chosen: true },
  personal: { label: 'Personal',   hint: 'Training, appointments, everything else', shades: 2, chosen: true },
  sleep:    { label: 'Sleep',      hint: 'Hours nothing gets scheduled into',  shades: 1, chosen: false },
};

/** The default when nothing better is known. Broad enough to rarely be wrong. */
export const DEFAULT_CATEGORY: Category = 'personal';

export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as string[]).includes(v);
}

/**
 * The CSS custom property for a category and shade.
 *
 * Clamped rather than cycled with a modulo, deliberately. A fifth course
 * reusing shade 0 is two courses that look alike, which labels resolve. A
 * modulo that wrapped into another family's variable would be a lecture
 * rendering in the coursework colour, which nothing resolves.
 */
export function colorVar(category: Category, shade = 0): string {
  const max = CATEGORY_META[category].shades - 1;
  const i = Math.min(Math.max(0, Math.trunc(shade)), max);
  return `var(--cat-${category}-${i})`;
}

/**
 * Which shade an entity gets, from its position among its own kind.
 *
 * Position in a stable sorted list, not order of creation, so removing a course
 * does not repaint the others. That rule is inherited from the previous palette
 * decision and it is the difference between colour meaning something and colour
 * being a side effect of when you happened to add things.
 */
export function shadeFor(id: string, siblingIds: string[]): number {
  const sorted = [...new Set(siblingIds)].sort();
  const i = sorted.indexOf(id);
  return i < 0 ? 0 : i;
}

// ── mapping things onto categories ──────────────────────────────────

/** `BusyBlock.kind` already carries this distinction; it just never had a colour. */
export function categoryForBusyKind(kind: 'class' | 'sleep' | 'work' | 'commitment'): Category {
  if (kind === 'class') return 'class';
  if (kind === 'sleep') return 'sleep';
  if (kind === 'work') return 'work';
  return 'personal';
}

/**
 * Weekly commitments split on whether the work is cognitive.
 *
 * `learning` and `project` become `focus` because self-directed study getting
 * real hours is the thing this product is for, and merging it into `personal`
 * next to a haircut makes the month view say less than it could.
 */
export function categoryForCommitment(c: 'fitness' | 'project' | 'learning' | 'personal'): Category {
  return c === 'project' || c === 'learning' ? 'focus' : 'personal';
}

/** Anything with a due date. Canvas produces nothing else. */
export function categoryForAssignment(): Category {
  return 'deadline';
}

/**
 * An imported calendar entry, from the signals a feed actually gives us.
 *
 * Only three are reliable, and guessing past them is how a monthly club meeting
 * becomes four weekly ones. A Canvas feed produces deadlines by definition. A
 * personal calendar produces fixed time, and the only further signal worth
 * trusting is an obvious course code or an obvious shift word in the title.
 */
const CLASS_HINT = /\b(lecture|lab|section|seminar|tutorial|studio|recitation)\b|\b[A-Z]{2,5}\s?\d{3}\b/;
const WORK_HINT = /\b(shift|work|meeting|standup|stand-up|on call|on-call)\b/i;

export function categoryForImportedEvent(
  produces: 'assignments' | 'events',
  title: string,
): Category {
  if (produces === 'assignments') return 'deadline';
  if (CLASS_HINT.test(title)) return 'class';
  if (WORK_HINT.test(title)) return 'work';
  return DEFAULT_CATEGORY;
}
