/**
 * Heron — domain types
 *
 * Everything the scheduler touches is defined here. Dates are ISO strings at
 * every boundary (storage, API, props) and only become `Date` objects inside
 * the functions that do arithmetic on them. Mixing the two is the single
 * easiest way to introduce a timezone bug you won't notice for a week.
 */

/** What kind of work an assignment is. Drives duration, method, and energy fit. */
import type { Category } from './categories.ts';

export type WorkKind =
  | 'exam'
  | 'quiz'
  | 'problem set'
  | 'writing'
  | 'reading'
  | 'lab'
  | 'project'
  | 'discussion'
  | 'other';

export const WORK_KINDS: WorkKind[] = [
  'exam', 'quiz', 'problem set', 'writing', 'reading', 'lab', 'project', 'discussion', 'other',
];

/** How a block of time should actually be spent. The study-methods layer. */
export type StudyMethod =
  | 'retrieval practice'   // closed-book self-testing — the highest-value default
  | 'practice problems'
  | 'drafting'
  | 'revising'
  | 'active reading'
  | 'lab prep'
  | 'build'
  | 'review notes'
  | 'training'
  | 'work session';

/** A deadline pulled from Canvas. */
export interface Assignment {
  id: string;
  title: string;
  /** Normalised course code, e.g. "CHEM 142" */
  course: string;
  /** Raw course label from Canvas, e.g. "CHEM 142 A" */
  courseFull: string;
  kind: WorkKind;
  /** ISO instant the work is due. */
  due: string;
  allDay: boolean;
  url: string | null;
  /** Minutes we think it takes. Seeded by kind, corrected by observed data. */
  estimatedMinutes: number;
  /** Minutes actually spent, summed from completed blocks. */
  actualMinutes: number;
  status: 'todo' | 'done' | 'dropped';
  /** Fraction of the final grade, 0–1. Defaults by kind until a syllabus says otherwise. */
  weight: number;
  /** How well the student feels they know this, 0–1. Low confidence pulls work forward. */
  confidence: number;
  /** ISO instant this was last worked on. Drives the spacing signal. */
  lastTouched: string | null;
}

/** A recurring weekly commitment: class, sleep, work shift, practice. */
export interface BusyBlock {
  id: string;
  /** 0 = Monday … 6 = Sunday. Monday-anchored because that's how a quarter reads. */
  day: number;
  /** Minutes after local midnight. */
  startMin: number;
  endMin: number;
  label: string;
  kind: 'class' | 'sleep' | 'work' | 'commitment';
}

export interface Availability {
  busy: BusyBlock[];
  /** Local time the student is willing to start, in minutes after midnight. */
  dayStartMin: number;
  dayEndMin: number;
  /** 'morning' | 'evening' | 'steady' — shifts which hours suit demanding work. */
  energy: EnergyPattern;
  /**
   * The student has decided this themselves, so observation must not overrule it.
   *
   * Absent means "no strong opinion", which is the honest default: the value
   * above starts as a setup guess rather than a considered answer. Set only when
   * they change it knowing what their own blocks say.
   */
  energyLocked?: boolean;
  /** Hard ceiling on scheduled study minutes in any one day. */
  maxDailyMinutes: number;
  /**
   * Per-weekday ceiling, 0 = Monday. `null` falls back to `maxDailyMinutes`.
   *
   * One number for every day is wrong for anyone with a job. Five hours of
   * project work after a nine-hour shift is not a plan, it's a plan you abandon
   * by Thursday; five hours on an open Saturday is easy.
   */
  maxDailyMinutesByDay?: Array<number | null>;
}

/**
 * When the student actually has attention available.
 *
 * `bimodal` exists because the first real user didn't fit the other three: sharp
 * early, sharp late, flat through the middle of the day. That's the shape of
 * anyone with a day job or a full class schedule, which is most of them.
 */
export type EnergyPattern = 'morning' | 'evening' | 'steady' | 'bimodal';

/** A scheduled study session — the thing the product actually produces. */
export interface StudyBlock {
  id: string;
  /** Set for coursework. Exactly one of this and `commitmentId` is present. */
  assignmentId: string | null;
  /** Set for recurring commitments. */
  commitmentId: string | null;
  course: string;
  title: string;
  /** ISO instants. */
  start: string;
  end: string;
  minutes: number;
  method: StudyMethod;
  /** Human-readable "why this, why now". One sentence, shown on the block. */
  why: string;
  /** 1-indexed: "session 2 of 3". */
  sessionIndex: number;
  sessionCount: number;
  status: 'planned' | 'done' | 'skipped' | 'partial';
  /** Minutes actually spent, once reported. */
  actualMinutes: number | null;
  /**
   * The student moved this block by hand, so the scheduler must leave it where
   * it is. Without this, dragging a block is pointless: the next replan puts it
   * straight back where the algorithm wanted it, and the app overrules the
   * person using it.
   */
  pinned?: boolean;
}

export interface Course {
  code: string;
  fullName: string;
  /**
   * What kind of hour this produces. Always `deadline`: Canvas emits due dates
   * and nothing else. Stored rather than assumed so a future source that emits
   * lectures does not have to fight the model.
   */
  category: Category;
  /**
   * Which step within the category's hue family, assigned once at creation.
   *
   * Never recomputed from list position. That would repaint every course after
   * one is deleted, which is the behaviour the palette decision ruled out.
   */
  shade: number;
}

/**
 * Something that recurs on a weekly quota rather than having a deadline.
 *
 * Runs five times a week. Six hours on a side project. Gym, practice, reading.
 * This is the primitive that lets Heron work outside a quarter, when there
 * is no Canvas feed and no due dates, and it's the only genuinely new concept
 * needed for that: everything else was already a busy block or an assignment.
 *
 * The scheduling difference that matters: there's no deadline, so the urgency
 * term that drives assignments is meaningless. Pressure comes from falling
 * behind the weekly target with fewer days left to make it up.
 */
export interface Commitment {
  id: string;
  title: string;
  category: CommitmentCategory;
  sessionsPerWeek: number;
  minutesPerSession: number;
  /** How much this matters relative to everything else, 0-1. */
  importance: number;
  /** Cognitive load, 0-1. Feeds the same energy-fit machinery as coursework. */
  demand: number;
  /** ISO instant this was last completed. Drives the staleness signal. */
  lastDoneAt: string | null;
  /** Sessions already finished in the current week. */
  doneThisWeek: number;
  /** Most things should happen at most once a day. Running twice isn't the goal. */
  maxPerDay: number;
  /**
   * Shortest session worth scheduling at all.
   *
   * For coursework, a trimmed session is partial progress and better than
   * nothing. For a project that needs a Pi booted and a sensor wired, twenty
   * minutes is setup and nothing else. Below this, the session isn't scheduled
   * and the shortfall is reported instead.
   */
  minSessionMinutes: number;
  /**
   * Time to hold after the session that isn't part of it: a shower after a run,
   * packing up, travel back. Real time, so nothing else gets scheduled into it,
   * but not part of the block itself.
   */
  bufferAfterMinutes: number;
  /**
   * Optional local-time window, in minutes after midnight, this may occupy.
   *
   * Exists because the energy model gets running exactly backwards: it's low
   * cognitive demand, so a low-energy hour "fits" perfectly, and the scheduler
   * cheerfully puts a run at 11pm for someone asleep at midnight. Physiology
   * isn't in the scoring function, so it goes here as a hard constraint.
   */
  windowStartMin: number | null;
  windowEndMin: number | null;
  active: boolean;
  /**
   * Which step within its hue family.
   *
   * There is no display `category` here on purpose: a commitment already
   * carries `category: CommitmentCategory`, and the display one is derived from
   * it by `categoryForCommitment`. Storing both would be two fields that can
   * disagree, and the one that disagreed would be the one on screen.
   */
  shade: number;
}

export type CommitmentCategory = 'fitness' | 'project' | 'learning' | 'personal';

/**
 * A one-off thing at a fixed time. A dentist appointment, a concert, a shift
 * swap, an exam sitting.
 *
 * Distinct from a `BusyBlock`, which recurs weekly, and from an `Assignment`,
 * which is work that needs doing by some deadline and that the scheduler is
 * free to place. This is neither: the time is decided, and the scheduler's only
 * job is to not book over it.
 */
export interface FixedEvent {
  id: string;
  title: string;
  /** ISO instants. The time is the point. */
  start: string;
  end: string;
  note: string | null;
  /** Guessed on import from the title, chosen by hand when added in the app. */
  category: Category;
  shade: number;
}

/** Everything we persist for one student. */
export interface PlanState {
  feedUrl: string | null;
  lastSyncedAt: string | null;
  courses: Course[];
  assignments: Assignment[];
  availability: Availability;
  commitments: Commitment[];
  events: FixedEvent[];
  blocks: StudyBlock[];
}
