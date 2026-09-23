/**
 * Week 1 import, three weeks of real use, then a week-4 Canvas refresh.
 *
 * The scenario the whole feed-memory change exists for, run end to end through
 * the same functions the app calls: the real Canvas parser on the real fixture,
 * `applyCanvas` for the merge, `applyCompletion` for the student's work, and
 * the planner exactly as `planInto` drives it.
 *
 * The tests prove each rule in isolation. This proves they compose: that a
 * refresh after three weeks of marking things done hands back a week that does
 * not re-plan finished work, orphan a block, lose a hand-typed task or recolour
 * a course. Every one of those would run cleanly and be quietly wrong.
 *
 *   npm run refresh
 */

import { readFileSync } from 'node:fs';
import { assignmentsFromICS } from '../src/lib/canvas/interpret.ts';
import { applyCanvas, describeMerge } from '../src/lib/canvas/merge.ts';
import { fitNewWork } from '../src/lib/schedule/fit-new.ts';
import { applyCompletion, applyLearnedEstimates } from '../src/lib/schedule/complete.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { emptyState, type HeronState } from '../src/lib/store.ts';
import { fmtDay, fmtTime, localParts } from '../src/lib/time.ts';
import type { Assignment } from '../src/lib/types.ts';

const TZ = 'America/Los_Angeles';
const DAY = 86_400_000;

const C = process.stdout.isTTY
  ? {
      dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
      b: (s: string) => `\x1b[1m${s}\x1b[0m`,
      green: (s: string) => `\x1b[32m${s}\x1b[0m`,
      red: (s: string) => `\x1b[31m${s}\x1b[0m`,
      amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
    }
  : { dim: (s: string) => s, b: (s: string) => s, green: (s: string) => s, red: (s: string) => s, amber: (s: string) => s };

/** The same shape `planInto` in use-heron.ts produces. No commitments here. */
function replan(prev: HeronState, now: Date): HeronState {
  const assignments = applyLearnedEstimates(prev.assignments);
  const settled = prev.blocks.filter((b) => b.status !== 'planned' || b.pinned);
  const result = planWeek(assignments, prev.availability, {
    now, tz: TZ, commitments: prev.commitments, existingBlocks: settled, events: prev.events,
  });
  return {
    ...prev,
    assignments,
    blocks: [...settled, ...result.blocks].sort((a, b) => a.start.localeCompare(b.start)),
    unscheduled: result.unscheduled,
    lastPlannedAt: now.toISOString(),
  };
}

// ── The feeds ─────────────────────────────────────────────────────────────────

const raw = readFileSync(new URL('../fixtures/sample-feed-midquarter.ics', import.meta.url), 'utf8');
const everything = assignmentsFromICS(raw);

const week1 = new Date('2026-08-03T16:00:00Z');   // Monday, 9am in Seattle
const week4 = new Date(week1.getTime() + 21 * DAY);

// In week 1, most instructors have published about five weeks ahead.
const publishedBy = week1.getTime() + 35 * DAY;
//
// Except one course, whose instructor publishes a week at a time. That is the
// decay at its sharpest: this is the work that is genuinely missing from the
// plan by week 4, and the refresh has to put it back inside the horizon.
const WEEKLY = 'CSE 121';
const feed1 = everything.filter((a) =>
  Date.parse(a.due) < (a.course === WEEKLY ? week1.getTime() + 7 * DAY : publishedBy));

// ── Weeks 1 to 3: a real student ──────────────────────────────────────────────

let state = applyCanvas(emptyState(), feed1, week1.toISOString()).next;

const handTask: Assignment = {
  id: `t-${week1.getTime()}`,
  title: 'Scholarship essay', course: 'Personal', courseFull: 'Personal',
  kind: 'writing', due: new Date(week4.getTime() + 5 * DAY).toISOString(), allDay: false,
  url: null, estimatedMinutes: 180, actualMinutes: 0, status: 'todo',
  weight: 0.05, confidence: 0.5, lastTouched: null,
};
state = { ...state, assignments: [...state.assignments, handTask] };

let skipped = 0;
for (let w = 0; w < 3; w++) {
  const start = new Date(week1.getTime() + w * 7 * DAY);
  const end = new Date(start.getTime() + 7 * DAY);
  state = replan(state, start);

  // Does most of it. Every third session is skipped: nobody is perfect, a
  // simulation where everyone is proves nothing about the skip path, and a
  // student who finishes everything leaves no plan for the refresh to protect.
  const due = state.blocks.filter((b) => b.status === 'planned' && Date.parse(b.end) <= end.getTime());
  due.forEach((b, i) => {
    const outcome = i % 3 === 2 ? 'skipped' : 'done';
    if (outcome === 'skipped') skipped += 1;
    state = { ...state, ...applyCompletion(state, b.id, outcome, outcome === 'done' ? b.minutes : null, new Date(b.end)) };
  });
}

// Monday of week 4: the student opens the app and plans the week from what
// Heron already knows. The daily Canvas check lands an hour later, on top of a
// plan they have just looked at, which is exactly the plan it must not move.
const before = replan(state, week4);
const refreshAt = new Date(week4.getTime() + 3_600_000);
const doneBefore = before.assignments.filter((a) => a.status === 'done');
const minutesBefore = new Map(before.assignments.map((a) => [a.id, a.actualMinutes]));
const shadesBefore = new Map(before.courses.map((c) => [c.code, c.shade]));

// ── The week-4 feed ───────────────────────────────────────────────────────────

// Everything is published now. Three things changed in Canvas since week 1:
//   - an instructor deleted an assignment nobody had started   → must go
//     (found among work whose only sessions were skipped: a student following
//     the plan has minutes against nearly everything due in the next month,
//     because sessions start early, so "untouched" by week 4 means "skipped")
//   - an instructor deleted one the student had already worked on → must stay,
//     because those minutes are the only record of the work anywhere
//   - a deadline was pushed two days                            → must move, and
//     keep the minutes already logged against it
const heldIds = new Set(before.assignments.map((a) => a.id));
const held = (id: string) => before.assignments.find((h) => h.id === id)!;
const upcoming = everything.filter((a) =>
  heldIds.has(a.id) && Date.parse(a.due) > week4.getTime() && held(a.id).status === 'todo');

// Chosen from work with no sessions in Monday's plan where possible, so the
// plan the student just looked at still has blocks the refresh must not touch.
// Otherwise every planned block belongs to an exempt assignment and "nothing
// moved" passes with nothing to test.
const mondayPlanned = new Set(before.blocks.filter((b) => b.status === 'planned').map((b) => b.assignmentId));
const prefer = <T extends Assignment>(list: T[], ok: (a: T) => boolean) =>
  list.find((a) => ok(a) && !mondayPlanned.has(a.id)) ?? list.find(ok);

const deleted = prefer(everything.filter((a) => heldIds.has(a.id)).reverse(), (a) =>
  held(a.id).status === 'todo' && held(a.id).actualMinutes === 0 && held(a.id).lastTouched === null);
const deletedTouched = prefer(upcoming, (a) => held(a.id).actualMinutes > 0);
const moved = prefer(upcoming, (a) => a !== deleted && a !== deletedTouched && held(a.id).actualMinutes > 0)
  ?? prefer(upcoming, (a) => a !== deleted && a !== deletedTouched);

if (!deleted || !deletedTouched || !moved) {
  console.error('  The fixture no longer has the three kinds of upcoming work this scenario needs.');
  process.exit(1);
}
const movedDue = new Date(Date.parse(moved.due) + 2 * DAY).toISOString();

const feed4 = everything
  .filter((a) => a.id !== deleted.id && a.id !== deletedTouched.id)
  .map((a) => (a.id === moved.id ? { ...a, due: movedDue } : a));

// What the old straight replace would have done, computed rather than claimed.
const replaceIds = new Set(feed4.map((a) => a.id));
const lostDone = doneBefore.filter((a) => a.status === 'done').length; // replace resets every status
const lostMinutes = [...minutesBefore.values()].reduce((s, m) => s + m, 0);
const lostHand = before.assignments.filter((a) => !replaceIds.has(a.id) && a.id.startsWith('t-')).length;

// ── Refresh ───────────────────────────────────────────────────────────────────

// The path the app takes on the daily check: merge, then fit only what is new
// or stranded. Not a replan: the week the student already saw must not move.
const { next, merge } = applyCanvas(before, feed4, refreshAt.toISOString());
const after = fitNewWork(next, merge, refreshAt, TZ).next;

// ── Report ────────────────────────────────────────────────────────────────────

console.log('');
console.log(C.b('  Week 1 import, three weeks of use, week 4 refresh'));
console.log(C.dim(`  fixture: sample-feed-midquarter.ics · ${everything.length} assignments in the full term`));
console.log('');
console.log(`  Week 1 feed        ${feed1.length} assignments published`);
console.log(`  Weeks 1–3          ${doneBefore.length} finished · ${Math.round(lostMinutes / 60)}h logged · ${skipped} sessions skipped · 1 hand-typed task`);
console.log(`  Week 4 feed        ${feed4.length} assignments`);
const row = (label: string, title: string) => console.log(C.dim(`                     ${label.padEnd(20)} "${title}"`));
row('deleted, skipped', deleted.title);
row(`deleted, ${held(deletedTouched.id).actualMinutes} min in`, deletedTouched.title);
row('moved +2 days', moved.title);
console.log(`  Refresh said       ${describeMerge(merge) ?? 'nothing new'}`);
console.log('');
console.log(C.amber('  What the old straight replace would have done'));
console.log(C.dim(`    reset ${lostDone} finished assignments to todo, discarded ${Math.round(lostMinutes / 60)}h of logged time,`));
console.log(C.dim(`    deleted ${lostHand} hand-typed task, and handed all of it back to the planner.`));
console.log('');

const checks: Array<[string, boolean, string?]> = [];
const check = (name: string, ok: boolean, detail?: string) => checks.push([name, ok, detail]);

const byId = new Map(after.assignments.map((a) => [a.id, a]));

const stillDone = doneBefore.filter((a) => byId.get(a.id)?.status === 'done').length;
check('finished work is still finished', stillDone === doneBefore.length, `${stillDone} of ${doneBefore.length}`);

const minutesKept = [...minutesBefore].every(([id, m]) => !byId.has(id) || byId.get(id)!.actualMinutes === m);
check('logged minutes are unchanged', minutesKept);

check('the hand-typed task survived', byId.has(handTask.id));

const orphans = after.blocks.filter((b) => b.assignmentId && !byId.has(b.assignmentId));
check('no block points at work that no longer exists', orphans.length === 0, `${orphans.length} orphaned`);

const replannedDone = after.blocks.filter((b) =>
  b.status === 'planned' && b.assignmentId && byId.get(b.assignmentId)?.status === 'done');
check('no finished assignment is planned again', replannedDone.length === 0, `${replannedDone.length} blocks`);

check('the deleted, untouched assignment is gone, with its blocks',
  !byId.has(deleted.id) && !after.blocks.some((b) => b.assignmentId === deleted.id));

check('the deleted, worked-on assignment kept its history',
  byId.get(deletedTouched.id)?.actualMinutes === held(deletedTouched.id).actualMinutes);
check('and is no longer planned',
  byId.get(deletedTouched.id)?.status === 'dropped'
  && !after.blocks.some((b) => b.assignmentId === deletedTouched.id && b.status === 'planned'));

check('the moved deadline took effect', byId.get(moved.id)?.due === movedDue);
check('and kept the minutes already spent on it',
  byId.get(moved.id)?.actualMinutes === held(moved.id).actualMinutes,
  `${held(moved.id).actualMinutes} min`);

const lateForMoved = after.blocks.filter((b) =>
  b.assignmentId === moved.id && b.status === 'planned' && Date.parse(b.end) > Date.parse(movedDue));
check('nothing is planned after its deadline', lateForMoved.length === 0);

const recoloured = after.courses.filter((c) => shadesBefore.has(c.code) && shadesBefore.get(c.code) !== c.shade);
check('no course changed colour', recoloured.length === 0, recoloured.map((c) => c.code).join(', '));

// The promise of the daily refresh. Every future planned block from before is
// still exactly where it was, unless its assignment left Canvas or its deadline
// moved in front of it.
const exempt = new Set([...merge.removedIds, ...merge.retiredIds, ...merge.movedIds]);
const stillThere = new Set(after.blocks.map((b) => `${b.id}@${b.start}`));
const shouldStay = before.blocks.filter((b) =>
  b.status === 'planned' && Date.parse(b.start) >= refreshAt.getTime()
  && !(b.assignmentId && exempt.has(b.assignmentId)));
const movedAnyway = shouldStay.filter((b) => !stillThere.has(`${b.id}@${b.start}`));
check('nothing already planned was moved', shouldStay.length > 0 && movedAnyway.length === 0,
  `${shouldStay.length - movedAnyway.length} of ${shouldStay.length} untouched`);

// The day's ceiling holds across old and new blocks together.
const cap = after.availability.maxDailyMinutes;
const byDay = new Map<string, { before: number; after: number }>();
for (const [list, key] of [[before.blocks, 'before'], [after.blocks, 'after']] as const) {
  for (const b of list) {
    if (!b.assignmentId || b.status !== 'planned' || Date.parse(b.start) < week4.getTime()) continue;
    const d = localParts(new Date(b.start), TZ).dateKey;
    const row = byDay.get(d) ?? { before: 0, after: 0 };
    row[key] += b.minutes;
    byDay.set(d, row);
  }
}
const overCap = [...byDay].filter(([, r]) => r.after > Math.max(cap, r.before));
check('no day went over its ceiling', overCap.length === 0, overCap.map(([d, r]) => `${d} ${r.after}min`).join(', '));

// Newly published work inside the planning horizon must either be planned or
// be in the "didn't fit" list. Silently absent is the one unacceptable answer.
const horizon = week4.getTime() + 14 * DAY;
const fresh = after.assignments.filter((a) =>
  !heldIds.has(a.id) && a.status === 'todo'
  && Date.parse(a.due) > week4.getTime() && Date.parse(a.due) <= horizon);
const accounted = fresh.filter((a) =>
  after.blocks.some((b) => b.assignmentId === a.id && b.status === 'planned')
  || after.unscheduled.some((u) => u.assignmentId === a.id));
// Zero of zero would pass and prove nothing, so an empty set fails too.
check('every newly published deadline is planned or reported',
  fresh.length > 0 && accounted.length === fresh.length,
  `${accounted.length} of ${fresh.length}`);

for (const [name, ok, detail] of checks) {
  const mark = ok ? C.green('  ✔') : C.red('  ✖');
  console.log(`${mark} ${name}${detail ? C.dim(`  ${detail}`) : ''}`);
}

console.log('');
console.log(C.b('  The rebuilt week'));
const planned = after.blocks.filter((b) => b.status === 'planned' && Date.parse(b.start) < week4.getTime() + 7 * DAY);
for (const b of planned.slice(0, 12)) {
  const isNew = b.assignmentId && !heldIds.has(b.assignmentId) ? C.amber(' new') : '';
  console.log(`    ${fmtDay(b.start, TZ).padEnd(12)} ${fmtTime(b.start, TZ).padStart(8)}  ${b.course.padEnd(9)} ${b.title}${isNew}`);
}
if (planned.length > 12) console.log(C.dim(`    …and ${planned.length - 12} more this week`));
if (after.unscheduled.length > 0) {
  console.log(C.dim(`    ${after.unscheduled.length} item(s) didn't fit and are reported, not hidden`));
}
console.log('');

if (checks.some(([, ok]) => !ok)) process.exit(1);
