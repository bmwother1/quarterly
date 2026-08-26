/**
 * When is a student finished setting up?
 *
 * Until now there was no answer, and that was a real defect rather than a
 * missing feature. The calendar warned "this week assumes you're free all day"
 * with no way to reply "that's right, I am" — so a student with genuinely no
 * fixed schedule got nagged forever, and one who *had* finished never got told.
 *
 * The fix is that every step is resolvable in two directions. Done or
 * deliberately skipped both count as resolved. Once every step is resolved the
 * student is **live**: setup prompts stop permanently and the app never brings
 * them up again unless asked.
 *
 * The rule underneath: an app is allowed to ask a question once. It is not
 * allowed to keep asking because the honest answer was "none".
 */

import type { QuarterlyState } from './store.ts';

export type StepId = 'work' | 'fixed' | 'sleep' | 'calendars';
export type StepState = 'todo' | 'done' | 'skipped';

export interface Step {
  id: StepId;
  title: string;
  /** What the student gets, not what the app collects. */
  blurb: string;
  /** Shown on the skip control. Naming the cost keeps the choice honest. */
  skipLabel: string;
  state: StepState;
  /** Steps without this are optional; the flow can finish without them. */
  required: boolean;
}

/**
 * Which steps a student has explicitly waved off.
 *
 * Stored separately from the data itself because "I have no fixed schedule" and
 * "I haven't told you about my fixed schedule" produce identical state and mean
 * opposite things.
 */
export type SkippedSteps = Partial<Record<StepId, boolean>>;

function hasWork(s: QuarterlyState): boolean {
  return s.commitments.some((c) => c.active)
    || s.assignments.some((a) => a.status === 'todo')
    || s.courses.length > 0;
}

function hasFixedTime(s: QuarterlyState): boolean {
  return s.availability.busy.some((b) => b.kind === 'work' || b.kind === 'class')
    || s.events.length > 0;
}

/**
 * Sleep always has a default, so "set" can't mean "non-empty". It means the
 * student has looked at it — tracked by them having touched anything in setup,
 * which `sleepConfirmed` records.
 */
function hasSleep(s: QuarterlyState): boolean {
  return s.sleepConfirmed === true;
}

function hasCalendars(s: QuarterlyState): boolean {
  return s.courses.length > 0 || s.events.some((e) => e.id.startsWith('imp-'));
}

export function steps(state: QuarterlyState): Step[] {
  const skipped: SkippedSteps = state.skippedSteps ?? {};

  const build = (
    id: StepId, title: string, blurb: string, skipLabel: string,
    satisfied: boolean, required: boolean,
  ): Step => ({
    id, title, blurb, skipLabel, required,
    state: satisfied ? 'done' : skipped[id] ? 'skipped' : 'todo',
  });

  return [
    build(
      'work', 'Something to plan',
      'One thing you want to make time for. The scheduler works out when.',
      'Skip for now',
      hasWork(state), true,
    ),
    build(
      'fixed', 'When you\'re already busy',
      'Classes, shifts, anything at a fixed time. Nothing gets scheduled over it.',
      'I have nothing fixed',
      hasFixedTime(state), true,
    ),
    build(
      'sleep', 'When you sleep',
      'So nothing lands at 2am. There\'s a sensible default if you\'d rather not.',
      'The default is fine',
      hasSleep(state), true,
    ),
    build(
      'calendars', 'Import a calendar',
      'Canvas, Google, Apple or Outlook, so you don\'t type it all in.',
      'Not now',
      hasCalendars(state), false,
    ),
  ];
}

/** A step still waiting on an answer, in either direction. */
export function unresolved(state: QuarterlyState): Step[] {
  return steps(state).filter((s) => s.state === 'todo');
}

/**
 * Live means finished. Every required step resolved, and at least one thing to
 * actually schedule — because a plan of nothing isn't a plan.
 *
 * Optional steps are ignored here on purpose. Making the calendar import
 * required would block every student who signs up before their quarter is
 * published, which in August is all of them.
 */
export function isLive(state: QuarterlyState): boolean {
  const all = steps(state);
  const requiredDone = all.filter((s) => s.required).every((s) => s.state !== 'todo');
  return requiredDone && hasWork(state);
}

/** 0–1, for a progress indicator that reflects required work only. */
export function progress(state: QuarterlyState): number {
  const required = steps(state).filter((s) => s.required);
  const resolved = required.filter((s) => s.state !== 'todo').length;
  return required.length === 0 ? 1 : resolved / required.length;
}

/**
 * The one prompt worth showing, or null.
 *
 * Deliberately returns a single item. A student who has skipped three things
 * should not be met with three banners; the app asks about the most valuable
 * one and lets the rest go.
 */
export function nextPrompt(state: QuarterlyState): Step | null {
  if (isLive(state)) return null;
  const todo = unresolved(state);
  // Required first, then in declared order — which is roughly value order.
  return todo.find((s) => s.required) ?? todo[0] ?? null;
}

/**
 * Set sleep hours and record that they were set, in one move.
 *
 * These two writes have to happen together and for a while they did not.
 * `/setup` wrote the hours and never touched `sleepConfirmed`, so the prompt on
 * `/week` kept asking a student who had already answered. The hours were saving
 * the whole time; there was just no way to tell, and the only control that
 * dismissed the prompt was "the default is fine", which is the one answer that
 * throws the real hours away.
 *
 * Sleep is the only step whose resolution is a flag rather than derived from the
 * data, because a default that was never looked at and a default the student
 * chose are identical in `availability`. That makes it the only step where a
 * writer can update the data and leave the question open, so the two writes live
 * here rather than at each call site.
 */
export function applySleepHours(
  state: QuarterlyState,
  wakeMin: number,
  bedMin: number,
): QuarterlyState {
  const busy = state.availability.busy.filter((b) => b.kind !== 'sleep');
  for (let day = 0; day < 7; day++) {
    busy.push({ id: `sleep-${day}`, day, startMin: bedMin, endMin: wakeMin, label: 'Sleep', kind: 'sleep' });
  }

  return {
    ...state,
    availability: {
      ...state.availability,
      busy,
      dayStartMin: wakeMin,
      // A bedtime past midnight wraps, so the waking day runs to just before it.
      dayEndMin: bedMin > wakeMin ? bedMin : 24 * 60 - 15,
    },
    sleepConfirmed: true,
  };
}
