/**
 * Brydon's real week, as a fixture.
 *
 * The off-season case: no Canvas feed, a full-time job, and a set of recurring
 * commitments. This is the scenario the product has to handle before September
 * 30, and the only way to use it before UW publishes courses.
 *
 *   npm run my-week
 */

import type { Availability, BusyBlock, Commitment } from '../src/lib/types.ts';
import { planWeek } from '../src/lib/schedule/plan.ts';

import { localParts, fmtTime, fmtDay } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';

const C = process.stdout.isTTY
  ? {
      dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
      b: (s: string) => `\x1b[1m${s}\x1b[0m`,
      cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
      amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
      red: (s: string) => `\x1b[31m${s}\x1b[0m`,
    }
  : { dim: (s: string) => s, b: (s: string) => s, cyan: (s: string) => s, amber: (s: string) => s, red: (s: string) => s };

function availability(): Availability {
  const busy: BusyBlock[] = [];

  for (let day = 0; day < 7; day++) {
    // Midnight to 6:30. Six and a half hours, which is what he actually sleeps.
    busy.push({ id: `sleep-${day}`, day, startMin: 0, endMin: 6 * 60 + 30, label: 'Sleep', kind: 'sleep' });
  }

  // Masons Supply, 7:30–16:00, plus fifteen minutes of commute either side.
  for (let day = 0; day < 5; day++) {
    busy.push({
      id: `work-${day}`, day,
      startMin: 7 * 60 + 15, endMin: 16 * 60 + 15,
      label: 'Masons Supply (+commute)', kind: 'work',
    });
  }

  return {
    busy,
    dayStartMin: 6 * 60 + 30,
    dayEndMin: 23 * 60 + 45,
    energy: 'bimodal',
    maxDailyMinutes: 300,
  };
}

const commitments: Commitment[] = [
  {
    id: 'run', title: 'Run 3 miles', category: 'fitness',
    sessionsPerWeek: 5, minutesPerSession: 35,
    importance: 0.8, demand: 0.25,
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1, active: true, color: '#10b981',
  },
  {
    id: 'stanford', title: 'Stanford AI agents course', category: 'learning',
    sessionsPerWeek: 3, minutesPerSession: 60,
    importance: 0.7, demand: 0.85,
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1, active: true, color: '#8b5cf6',
  },
  {
    id: 'quarterly', title: 'Quarterly', category: 'project',
    sessionsPerWeek: 4, minutesPerSession: 90,
    importance: 0.9, demand: 0.85,
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1, active: true, color: '#e11d48',
  },
  {
    id: 'prismwave', title: 'Prismwave Network', category: 'project',
    sessionsPerWeek: 2, minutesPerSession: 90,
    importance: 0.6, demand: 0.85,
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1, active: true, color: '#0ea5e9',
  },
  {
    id: 'launchmon', title: 'Golf launch monitor', category: 'project',
    sessionsPerWeek: 2, minutesPerSession: 90,
    importance: 0.45, demand: 0.85,
    lastDoneAt: null, doneThisWeek: 0, maxPerDay: 1, active: true, color: '#f59e0b',
  },
];

const av = availability();
const plan = planWeek([], av, { tz: TZ, commitments });

const asked = commitments.reduce((s, c) => s + c.sessionsPerWeek * c.minutesPerSession, 0);

console.log('');
console.log(C.b('  Your week'));
console.log(C.dim(
  `  ${plan.stats.blockCount} blocks · ${(plan.stats.scheduledMinutes / 60).toFixed(1)}h scheduled ` +
  `of ${(plan.stats.usableMinutes / 60).toFixed(1)}h usable · you asked for ${(asked / 60).toFixed(1)}h`,
));
console.log(C.dim('  work 7:15–16:15 with commute · sleep 00:00–06:30 · bimodal energy'));

let lastDay = '';
for (const b of plan.blocks) {
  const day = fmtDay(b.start, TZ);
  if (day !== lastDay) {
    console.log('');
    console.log('  ' + C.b(day));
    lastDay = day;
  }
  const when = `${fmtTime(b.start, TZ)}–${fmtTime(b.end, TZ)}`;
  console.log(`    ${C.dim(when.padEnd(17))} ${C.cyan(b.course.padEnd(26))} ${C.dim(b.why)}`);
}

if (plan.unscheduled.length) {
  console.log('');
  console.log(C.amber(`  DIDN'T FIT`));
  console.log(C.dim('  ' + '─'.repeat(66)));
  for (const u of plan.unscheduled) {
    const detail = u.sessionsShort ? `${u.sessionsShort} session(s) short` : `${u.minutes}m`;
    console.log(`    ${C.cyan(u.course.padEnd(26))} ${C.dim(`${detail} · ${u.reason}`)}`);
  }
  console.log('');
  console.log(C.dim('  This is the honest part. Something has to give, and the app should say which.'));
}

const byDay = new Map<string, number>();
for (const b of plan.blocks) {
  const key = localParts(new Date(b.start), TZ).dateKey;
  byDay.set(key, (byDay.get(key) ?? 0) + b.minutes);
}
console.log('');
console.log(C.b('  LOAD BY DAY'));
console.log(C.dim('  ' + '─'.repeat(66)));
const peak = Math.max(...byDay.values(), 1);
for (const [day, minutes] of [...byDay].sort()) {
  const bar = '█'.repeat(Math.max(1, Math.round((minutes / peak) * 26)));
  console.log(`  ${C.dim(day)}  ${minutes > 270 ? C.red(bar) : C.amber(bar)} ${(minutes / 60).toFixed(1)}h`);
}
console.log('');
