/**
 * Quarterly — domain types
 *
 * Everything the scheduler touches is defined here. Dates are ISO strings at
 * every boundary (storage, API, props) and only become `Date` objects inside
 * the functions that do arithmetic on them. Mixing the two is the single
 * easiest way to introduce a timezone bug you won't notice for a week.
 */

/** What kind of work an assignment is. Drives duration, method, and energy fit. */
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
  /** Hard ceiling on scheduled study minutes in any one day. */
  maxDailyMinutes: number;
}

export type EnergyPattern = 'morning' | 'evening' | 'steady';

/** A scheduled study session — the thing the product actually produces. */
export interface StudyBlock {
  id: string;
  assignmentId: string;
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
}

export interface Course {
  code: string;
  fullName: string;
  color: string;
}

/** Everything we persist for one student. */
export interface PlanState {
  feedUrl: string | null;
  lastSyncedAt: string | null;
  courses: Course[];
  assignments: Assignment[];
  availability: Availability;
  blocks: StudyBlock[];
}
