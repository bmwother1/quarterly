/**
 * Print a planned week to the terminal.
 *
 * The fastest way to sanity-check the scheduler without a browser — run it
 * after changing any of the scoring weights and read whether the result looks
 * like a week a real person would actually follow.
 *
 *   node scripts/preview-week.ts                        # sample feed, open week
 *   node scripts/preview-week.ts <feed.ics|url>         # your own feed
 *   node scripts/preview-week.ts <src> --energy evening
 *   node scripts/preview-week.ts <src> --busy           # with a realistic class schedule
 */

import { readFileSync } from 'node:fs';
import { assignmentsFromICS } from '../src/lib/canvas/interpret.ts';
import { looksLikeCalendar } from '../src/lib/canvas/ics.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { localParts, fmtTime, fmtDay } from '../src/lib/time.ts';
import type { BusyBlock, EnergyPattern } from '../src/lib/types.ts';

const TZ = 'America/Los_Angeles';
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));

const energyArg = args[args.indexOf('--energy') + 1];
const energy: EnergyPattern = ['morning', 'evening', 'steady'].includes(energyArg)
  ? (energyArg as EnergyPattern)
  : 'steady';

// The value after --energy is not a source path.
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--energy');
const src = positional[0] ?? new URL('../fixtures/sample-feed-midquarter.ics', import.meta.url).pathname;

const C = process.stdout.isTTY
  ? {
      dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
      b: (s: string) => `\x1b[1m${s}\x1b[0m`,
      cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
      amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
      red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    }
  : { dim: (s: string) => s, b: (s: string) => s, cyan: (s: string) => s, amber: (s: string) => s, red: (s: string) => s };

async function load(source: string): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source.replace(/^http:/i, 'https:'), { redirect: 'follow' });
    if (!res.ok) throw new Error(`Canvas returned HTTP ${res.status}`);
    return res.text();
  }
  return readFileSync(source, 'utf8');
}

/** A plausible MWF-plus-lab week, so the output isn't a fantasy of infinite free time. */
function realisticBusy(): BusyBlock[] {
  const classes: BusyBlock[] = [];
  for (const day of [0, 2, 4]) {
    classes.push({ id: `chem-${day}`, day, startMin: 9 * 60 + 30, endMin: 10 * 60 + 20, label: 'CHEM 142', kind: 'class' });
    classes.push({ id: `math-${day}`, day, startMin: 11 * 60 + 30, endMin: 12 * 60 + 20, label: 'MATH 124', kind: 'class' });
  }
  for (const day of [1, 3]) {
    classes.push({ id: `cse-${day}`, day, startMin: 10 * 60, endMin: 11 * 60 + 20, label: 'CSE 121', kind: 'class' });
    classes.push({ id: `engl-${day}`, day, startMin: 13 * 60, endMin: 14 * 60 + 20, label: 'ENGL 131', kind: 'class' });
  }
  classes.push({ id: 'lab', day: 3, startMin: 14 * 60 + 30, endMin: 17 * 60 + 20, label: 'CHEM lab', kind: 'class' });
  classes.push({ id: 'job-1', day: 5, startMin: 10 * 60, endMin: 16 * 60, label: 'Work shift', kind: 'work' });
  return classes;
}

const raw = await load(src);
if (!looksLikeCalendar(raw)) {
  console.error('\n  That source is not a calendar file.\n');
  process.exit(1);
}

const assignments = assignmentsFromICS(raw);
const availability = {
  ...defaultAvailability(),
  energy,
  busy: flags.has('--busy') ? [...defaultAvailability().busy, ...realisticBusy()] : defaultAvailability().busy,
};

const t0 = performance.now();
const plan = planWeek(assignments, availability, { tz: TZ });
const ms = performance.now() - t0;

console.log('');
console.log(C.b('  Your week'));
console.log(
  C.dim(
    `  ${assignments.length} assignments tracked · ${plan.stats.blockCount} blocks · ` +
      `${Math.round(plan.stats.scheduledMinutes / 60)}h scheduled of ${Math.round(plan.stats.usableMinutes / 60)}h usable · ` +
      `planned in ${ms.toFixed(0)}ms`,
  ),
);
console.log(C.dim(`  energy: ${energy}${flags.has('--busy') ? ' · with classes and a work shift' : ' · nothing but sleep blocked out'}`));
console.log('');

if (plan.blocks.length === 0) {
  console.log(C.amber('  Nothing scheduled — the feed may be empty or the week fully booked.\n'));
}

let lastDay = '';
for (const b of plan.blocks) {
  const day = fmtDay(b.start, TZ);
  if (day !== lastDay) {
    console.log('');
    console.log('  ' + C.b(day));
    lastDay = day;
  }
  const when = `${fmtTime(b.start, TZ)}–${fmtTime(b.end, TZ)}`;
  const session = b.sessionCount > 1 ? ` (${b.sessionIndex}/${b.sessionCount})` : '';
  console.log(`    ${C.dim(when.padEnd(18))} ${C.cyan(b.course.padEnd(10))} ${(b.title + session).padEnd(30)} ${C.dim(b.method)}`);
  console.log(`    ${' '.repeat(18)} ${C.dim('↳ ' + b.why)}`);
}

if (plan.overdue.length) {
  console.log('');
  console.log(C.amber(`  DEADLINES ALREADY PASSED (${plan.overdue.length})`));
  console.log(C.dim('  ' + '─'.repeat(64)));
  for (const a of plan.overdue.slice(0, 8)) {
    console.log(`    ${C.cyan(a.course.padEnd(10))} ${a.title.padEnd(32)} ${C.dim(fmtDay(a.due, TZ))}`);
  }
  if (plan.overdue.length > 8) console.log(C.dim(`    …and ${plan.overdue.length - 8} more`));
  console.log(C.dim('\n  Not scheduled — the feed can\'t tell us what you already handed in.'));
}

if (plan.unscheduled.length) {
  console.log('');
  console.log(C.amber(`  DIDN'T FIT (${plan.unscheduled.length})`));
  console.log(C.dim('  ' + '─'.repeat(64)));
  for (const u of plan.unscheduled.slice(0, 12)) {
    console.log(`    ${C.cyan(u.course.padEnd(10))} ${u.title.padEnd(32)} ${C.dim(`${u.minutes}m · ${u.reason}`)}`);
  }
  if (plan.unscheduled.length > 12) console.log(C.dim(`    …and ${plan.unscheduled.length - 12} more`));
  console.log('');
  console.log(C.dim('  This list is the honest part. A planner that hides it is one you quit in week 4.'));
}

// Per-day load, so it's obvious at a glance whether the week is survivable.
const byDay = new Map<string, number>();
for (const b of plan.blocks) {
  const key = localParts(new Date(b.start), TZ).dateKey;
  byDay.set(key, (byDay.get(key) ?? 0) + b.minutes);
}
if (byDay.size) {
  console.log('');
  console.log(C.b('  LOAD BY DAY'));
  console.log(C.dim('  ' + '─'.repeat(64)));
  const peak = Math.max(...byDay.values());
  for (const [day, minutes] of [...byDay].sort()) {
    const bar = '█'.repeat(Math.max(1, Math.round((minutes / peak) * 24)));
    const painted = minutes > 300 ? C.red(bar) : C.amber(bar);
    console.log(`  ${C.dim(day)}  ${painted} ${(minutes / 60).toFixed(1)}h`);
  }
}
console.log('');
