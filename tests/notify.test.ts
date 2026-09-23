import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Assignment, Commitment, StudyBlock } from '../src/lib/types.ts';
import { nextNotice, violatesTone, BANNED_PHRASES } from '../src/lib/notify.ts';
import { inferEnergyPattern, hourStats, deadHours, durationBias, MIN_OBSERVATIONS } from '../src/lib/schedule/observed.ts';
import { zonedInstant } from '../src/lib/time.ts';

const TZ = 'America/Los_Angeles';

function block(over: Partial<StudyBlock> & { id: string }): StudyBlock {
  return {
    assignmentId: null, commitmentId: null, course: 'MATH 124', title: 'Homework',
    start: zonedInstant('2026-10-05', 17 * 60, TZ).toISOString(),
    end: zonedInstant('2026-10-05', 18 * 60, TZ).toISOString(),
    minutes: 60, method: 'practice problems',
    why: 'Session 2 of 4 — due Thursday, and this is the last comfortable slot for it.',
    sessionIndex: 1, sessionCount: 1, status: 'planned', actualMinutes: null, ...over,
  };
}

/** n settled blocks at a given hour, `completed` of which were finished. */
function atHour(hour: number, attempted: number, completed: number, dayOffset = 0): StudyBlock[] {
  return Array.from({ length: attempted }, (_, i) => block({
    id: `b-${hour}-${i}-${dayOffset}`,
    start: zonedInstant(`2026-09-${String(1 + ((i + dayOffset) % 28)).padStart(2, '0')}`, hour * 60, TZ).toISOString(),
    end: zonedInstant(`2026-09-${String(1 + ((i + dayOffset) % 28)).padStart(2, '0')}`, hour * 60 + 60, TZ).toISOString(),
    status: i < completed ? 'done' : 'skipped',
    actualMinutes: i < completed ? 60 : 0,
  }));
}

describe('learning from behaviour', () => {
  test('says nothing until there is enough evidence', () => {
    // A confidently wrong personalisation costs more trust than generic copy.
    assert.equal(inferEnergyPattern(atHour(8, 3, 3), TZ), null);
    assert.equal(inferEnergyPattern([], TZ), null);
  });

  test('recognises a morning person from what they finished', () => {
    const blocks = [...atHour(8, 10, 9), ...atHour(21, 10, 2)];
    const r = inferEnergyPattern(blocks, TZ);
    assert.equal(r?.pattern, 'morning');
    assert.ok(r!.observations >= MIN_OBSERVATIONS);
    assert.ok(r!.confidence > 0.4);
  });

  test('recognises an evening person', () => {
    const blocks = [...atHour(8, 10, 2), ...atHour(21, 10, 9)];
    assert.equal(inferEnergyPattern(blocks, TZ)?.pattern, 'evening');
  });

  test('recognises the two-peaked day', () => {
    const blocks = [...atHour(7, 8, 7), ...atHour(14, 8, 2), ...atHour(20, 8, 7)];
    assert.equal(inferEnergyPattern(blocks, TZ)?.pattern, 'bimodal');
  });

  test('a skipped block counts as attempted, not ignored', () => {
    const stats = hourStats(atHour(9, 4, 1), TZ);
    const nine = stats.find((h) => h.hour === 9)!;
    assert.equal(nine.attempted, 4);
    assert.equal(nine.completed, 1);
    assert.equal(nine.rate, 0.25);
  });

  test('planned blocks are not evidence of anything yet', () => {
    const stats = hourStats([block({ id: 'p', status: 'planned' })], TZ);
    assert.equal(stats.reduce((s, h) => s + h.attempted, 0), 0);
  });

  test('dead hours need per-hour evidence, not just a total', () => {
    assert.deepEqual(deadHours([...atHour(23, 4, 0), ...atHour(8, 4, 4)], TZ), [23]);
    assert.deepEqual(deadHours(atHour(23, 2, 0), TZ), [], 'two observations is not a pattern');
  });

  test('duration bias is reported per course and needs samples', () => {
    const chem = Array.from({ length: 4 }, (_, i) => block({
      id: `c${i}`, course: 'CHEM 142', status: 'done', minutes: 60, actualMinutes: 130,
    }));
    const [worst] = durationBias(chem);
    assert.equal(worst.course, 'CHEM 142');
    assert.ok(worst.ratio > 2);

    assert.deepEqual(durationBias(chem.slice(0, 2)), [], 'two samples is not a pattern');
  });
});

describe('notification tone', () => {
  const base = { assignments: [] as Assignment[], commitments: [] as Commitment[], tz: TZ, lastSentAt: null };

  test('the nudge carries the block reason, not a reminder', () => {
    const now = zonedInstant('2026-10-05', 16 * 60 + 50, TZ);
    const n = nextNotice({ ...base, now, blocks: [block({ id: 'x' })] });
    assert.equal(n?.kind, 'next-up');
    assert.match(n!.title, /MATH 124 in \d+ min/);
    assert.match(n!.body, /due Thursday/);
  });

  test('no notice when nothing is imminent', () => {
    // Silence is the common and correct answer. An app that always has
    // something to say is one people mute.
    const now = zonedInstant('2026-10-05', 9 * 60, TZ);
    assert.equal(nextNotice({ ...base, now, blocks: [block({ id: 'x' })] }), null);
  });

  test('one a day, except the time-critical nudge', () => {
    const now = zonedInstant('2026-10-05', 19 * 60, TZ);
    const missed = [
      block({ id: 'm1', end: zonedInstant('2026-10-05', 12 * 60, TZ).toISOString() }),
      block({ id: 'm2', end: zonedInstant('2026-10-05', 13 * 60, TZ).toISOString() }),
    ];
    const alreadySent = zonedInstant('2026-10-05', 8 * 60, TZ).toISOString();

    assert.equal(nextNotice({ ...base, now, blocks: missed, lastSentAt: alreadySent }), null);
    assert.ok(nextNotice({ ...base, now, blocks: missed, lastSentAt: null }));

    // The imminent nudge still gets through — it is worthless if it arrives late.
    const imminent = [...missed, block({
      id: 'soon',
      start: zonedInstant('2026-10-05', 19 * 60 + 10, TZ).toISOString(),
      end: zonedInstant('2026-10-05', 20 * 60, TZ).toISOString(),
    })];
    assert.equal(nextNotice({ ...base, now, blocks: imminent, lastSentAt: alreadySent })?.kind, 'next-up');
  });

  test('recovery leads with reassurance and never counts failures at you', () => {
    const now = zonedInstant('2026-10-05', 19 * 60, TZ);
    const missed = [
      block({ id: 'm1', end: zonedInstant('2026-10-05', 12 * 60, TZ).toISOString() }),
      block({ id: 'm2', end: zonedInstant('2026-10-05', 13 * 60, TZ).toISOString() }),
    ];
    const n = nextNotice({ ...base, now, blocks: missed })!;
    assert.equal(n.kind, 'recovery');
    assert.match(n.title, /still works/);
  });

  test('every message passes the tone rules', () => {
    // Enforced in code rather than left to whoever writes the copy next.
    const cases: Array<{ now: Date; blocks: StudyBlock[]; commitments?: Commitment[] }> = [
      { now: zonedInstant('2026-10-05', 16 * 60 + 50, TZ), blocks: [block({ id: 'a' })] },
      {
        now: zonedInstant('2026-10-05', 19 * 60, TZ),
        blocks: [
          block({ id: 'm1', end: zonedInstant('2026-10-05', 12 * 60, TZ).toISOString() }),
          block({ id: 'm2', end: zonedInstant('2026-10-05', 13 * 60, TZ).toISOString() }),
        ],
      },
    ];

    for (const c of cases) {
      const n = nextNotice({ ...base, ...c, commitments: c.commitments ?? [] });
      if (!n) continue;
      for (const text of [n.title, n.body]) {
        const bad = violatesTone(text);
        assert.equal(bad, null, `"${text}" contains banned phrase "${bad}"`);
      }
    }
  });

  test('the Sunday look-ahead counts hours in English', () => {
    // Found checking the rest of the copy after the planner's "due in 1 hours".
    // An hour of study next week read "About 1 hours planned", and one short
    // block read "About 0 hours planned".
    const now = zonedInstant('2026-10-11', 18 * 60, TZ);   // a Sunday evening
    const week = (minutes: number) => [block({
      id: 'x', minutes,
      start: zonedInstant('2026-10-12', 10 * 60, TZ).toISOString(),
      end: zonedInstant('2026-10-12', 10 * 60 + minutes, TZ).toISOString(),
    })];

    const hour = nextNotice({ ...base, now, blocks: week(60) });
    assert.equal(hour?.kind, 'look-ahead');
    assert.doesNotMatch(hour!.body, /\b1 hours\b/);

    const short = nextNotice({ ...base, now, blocks: week(25) });
    assert.doesNotMatch(short!.body, /\b0 hours\b/);
  });

  test('the Sunday quota check counts the sessions on the calendar', () => {
    // The weekly tally is wiped when the week's first replan comes after a
    // session was already done. The planner stopped trusting it alone; this
    // message did not, and could ask someone who ran three times whether five
    // a week was too many, on the strength of "1 of 5".
    const run: Commitment = {
      id: 'run', title: 'Run', category: 'fitness', sessionsPerWeek: 5, minutesPerSession: 30,
      importance: 0.8, demand: 0.25, lastDoneAt: null, doneThisWeek: 1, maxPerDay: 1,
      minSessionMinutes: 25, bufferAfterMinutes: 0, windowStartMin: null, windowEndMin: null,
      active: true, shade: 0,
    };
    const ran = ['2026-10-05', '2026-10-06', '2026-10-07'].map((day) => block({
      id: `run-${day}`, commitmentId: 'run', course: 'Run', title: 'Run', minutes: 30,
      start: zonedInstant(day, 7 * 60, TZ).toISOString(),
      end: zonedInstant(day, 7 * 60 + 30, TZ).toISOString(),
      status: 'done', actualMinutes: 30,
    }));
    const now = zonedInstant('2026-10-11', 18 * 60, TZ);   // Sunday evening of that week

    const n = nextNotice({ ...base, now, blocks: ran, commitments: [run] });
    assert.ok(n?.kind !== 'quota-strain' || n.title.includes('3 of 5'), `said "${n?.title}" after three runs`);
  });

  test('the banned list actually catches a mean-boss message', () => {
    assert.ok(violatesTone("Don't forget! You're behind schedule."));
    assert.ok(violatesTone('You always skip your evening blocks'));
    assert.equal(violatesTone('Next up: MATH 124, session 2 of 4.'), null);
    assert.ok(BANNED_PHRASES.includes('streak'), 'streaks are the mechanic to avoid');
  });
});
