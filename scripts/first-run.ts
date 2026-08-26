/**
 * What a brand-new student actually gets from the two-question first run.
 *
 * This is the single most-travelled path in the product and the one where a bad
 * result is least recoverable, so it's worth being able to read the output
 * without a browser.
 *
 *   node scripts/first-run.ts
 */

import type { Commitment } from '../src/lib/types.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';
import { defaultAvailability } from '../src/lib/schedule/slots.ts';
import { CATEGORY_DEMAND } from '../src/lib/schedule/score.ts';
import { localParts, fmtTime, fmtDay } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';

const C = process.stdout.isTTY
  ? { dim: (s: string) => `\x1b[2m${s}\x1b[0m`, b: (s: string) => `\x1b[1m${s}\x1b[0m`,
      cyan: (s: string) => `\x1b[36m${s}\x1b[0m`, amber: (s: string) => `\x1b[33m${s}\x1b[0m` }
  : { dim: (s: string) => s, b: (s: string) => s, cyan: (s: string) => s, amber: (s: string) => s };

/** Exactly what /start creates from one tapped example. */
function fromFirstRun(title: string, per: number, mins: number, category: Commitment['category']): Commitment {
  return {
    id: 'first', title, category,
    sessionsPerWeek: per, minutesPerSession: mins,
    importance: 0.7, demand: CATEGORY_DEMAND[category],
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1,
    minSessionMinutes: category === 'project' ? 60 : Math.min(30, mins),
    bufferAfterMinutes: category === 'fitness' ? 10 : 0,
    windowStartMin: category === 'fitness' ? 6 * 60 : null,
    windowEndMin: category === 'fitness' ? 21 * 60 : null,
    active: true, shade: 0,
  };
}

const cases: Array<[string, number, number, Commitment['category']]> = [
  ['Study for a class', 4, 60, 'learning'],
  ['Run', 4, 40, 'fitness'],
  ['Work on my project', 3, 90, 'project'],
];

for (const [title, per, mins, category] of cases) {
  const commitment = fromFirstRun(title, per, mins, category);
  const plan = planWeek([], defaultAvailability(), { tz: TZ, commitments: [commitment] });

  console.log('');
  console.log(C.b(`  "${title}" · ${per}× a week · ${mins} min`));
  console.log(C.dim(`  ${plan.stats.blockCount} blocks · ${(plan.stats.scheduledMinutes / 60).toFixed(1)}h planned`));

  const hours = plan.blocks.map((b) => localParts(new Date(b.start), TZ).hour);
  const days = new Set(plan.blocks.map((b) => localParts(new Date(b.start), TZ).dateKey));

  for (const b of plan.blocks.slice(0, 5)) {
    console.log(`    ${C.dim(fmtDay(b.start, TZ).padEnd(12))} ${fmtTime(b.start, TZ).padStart(8)}  ${C.cyan(b.course)}`);
  }
  if (plan.blocks.length > 5) console.log(C.dim(`    …and ${plan.blocks.length - 5} more`));

  // How this path actually fails: an empty week, or a shortfall reported on a
  // calendar with nothing in it — both of which make the app look broken to
  // someone who has been using it for ten seconds.
  if (plan.blocks.length === 0) console.log(C.amber('    ⚠ nothing scheduled — a first run that produces an empty week'));
  if (days.size < Math.min(per, 5)) console.log(C.amber(`    ⚠ only ${days.size} distinct days for ${per} sessions`));
  if (plan.unscheduled.length) console.log(C.amber(`    ⚠ ${plan.unscheduled.length} didn't fit on an empty calendar`));

  // Same hour every day is deliberate, not a fault. The fit function matches
  // cognitive demand to available energy, so a given kind of work lands in the
  // same band each day — and a consistent time is what makes a habit a habit.
  if (hours.length && new Set(hours).size === 1) {
    console.log(C.dim(`    consistent at ${hours[0]}:00 — same demand, same energy curve, every day`));
  }
}
console.log('');
