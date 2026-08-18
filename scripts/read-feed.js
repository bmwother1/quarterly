#!/usr/bin/env node
/**
 * Quarterly — Canvas feed reader
 * ------------------------------------------------------------------
 * Reads a Canvas calendar (iCal) feed and prints your real deadlines,
 * grouped by course and by week.
 *
 * This is week 1's proof: if this runs, the whole product is possible.
 * No institutional approval, no OAuth, no credentials. Just your feed URL.
 *
 * USAGE
 *   node read-feed.js "https://canvas.uw.edu/feeds/calendars/user_XXXX.ics"
 *   node read-feed.js sample-feed.ics          (works on a local file too)
 *   node read-feed.js <url> --json             (machine-readable output)
 *   node read-feed.js <url> --all              (include non-assignment events)
 *
 * WHERE TO GET YOUR URL
 *   Canvas → Calendar → "Calendar Feed" (right sidebar) → copy the link.
 *   Keep it private. Anyone with that link can see your schedule.
 *
 * No npm install required. Node 18+ only.
 */

'use strict';
const fs = require('fs');

// ─── config ────────────────────────────────────────────────────────
const TZ = 'America/Los_Angeles';   // change if you're not on Pacific time

// ─── tiny ICS parser ───────────────────────────────────────────────
// ICS is a simple line-based format, but it has two quirks we must handle:
//   1. "Line folding" — long lines wrap, and continuation lines start with
//      a space or tab. We have to glue them back together FIRST.
//   2. Escaped characters inside text values: \n \, \; \\
function unfold(raw) {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '');   // join folded continuation lines
}

function unescapeText(s) {
  return s
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/** Split "DTSTART;TZID=America/Los_Angeles:20261012T235900" into
 *  { name:'DTSTART', params:{TZID:'...'}, value:'20261012T235900' } */
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(';');
  const name = parts[0].toUpperCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq > -1) params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

/** ICS timestamps come in three shapes. Return a real JS Date. */
function toDate(value, params) {
  // 20261012                     → all-day
  if (/^\d{8}$/.test(value) || params.VALUE === 'DATE') {
    const y = +value.slice(0, 4), m = +value.slice(4, 6), d = +value.slice(6, 8);
    return { date: new Date(Date.UTC(y, m - 1, d, 12)), allDay: true };
  }
  // 20261013T065900Z             → UTC
  // 20261012T235900              → floating / TZID local
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!m) return null;
  const [, Y, Mo, D, H, Mi, S, z] = m;
  if (z) return { date: new Date(Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S)), allDay: false };

  // No Z: this is a wall-clock time in the given TZID (or our default zone).
  // We need the UTC instant whose local time in that zone reads back as this
  // wall clock. Solve it by measuring the zone's offset and correcting twice
  // (the second pass catches DST boundaries).
  const zone = params.TZID || TZ;
  const target = Date.UTC(+Y, +Mo - 1, +D, +H, +Mi, +S);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const readsBackAs = wallClockIn(guess, zone);
    const drift = target - readsBackAs;
    if (drift === 0) break;
    guess += drift;                     // recompute from target, never accumulate
  }
  return { date: new Date(guess), allDay: false };
}

/** What wall clock does this instant show in `zone`? Returned as a UTC-based
 *  epoch so it can be compared against `target` directly. */
function wallClockIn(epoch, zone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(epoch)).map(x => [x.type, x.value])
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
}

function parseICS(raw) {
  const lines = unfold(raw).split('\n');
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) { cur = {}; continue; }
    if (line.startsWith('END:VEVENT')) { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'SUMMARY') cur.summary = unescapeText(p.value);
    else if (p.name === 'DESCRIPTION') cur.description = unescapeText(p.value);
    else if (p.name === 'URL') cur.url = p.value;
    else if (p.name === 'UID') cur.uid = p.value;
    else if (p.name === 'DTSTART') cur.start = toDate(p.value, p.params);
    else if (p.name === 'DTEND') cur.end = toDate(p.value, p.params);
  }
  return events;
}

// ─── Canvas-specific interpretation ────────────────────────────────
// Canvas writes summaries like: "Problem Set 4 [CHEM 142 A]"
// and UIDs like: "event-assignment-9871234" vs "event-calendar-event-55512"
function interpret(ev) {
  const raw = ev.summary || '(untitled)';
  const m = /^(.*?)\s*\[([^\]]+)\]\s*$/.exec(raw);
  const title = m ? m[1].trim() : raw;
  const course = m ? m[2].trim() : 'Unknown course';
  const isAssignment = /assignment/i.test(ev.uid || '');
  return {
    title,
    course,
    courseShort: course.replace(/\s+[A-Z]{1,3}\d?$/, ''),   // "CHEM 142 AA" → "CHEM 142"
    isAssignment,
    kind: guessKind(title),
    due: ev.start ? ev.start.date : null,
    allDay: ev.start ? ev.start.allDay : false,
    url: ev.url || null,
  };
}

/** Rough classifier. This is the seed of the real "what kind of work is this"
 *  logic — durations and study methods will hang off these categories later. */
function guessKind(title) {
  const t = title.toLowerCase();
  // Order matters. "Major Paper 2 Final" is writing, not an exam — so the
  // specific words win before the generic ones.
  if (/\b(essay|paper|draft|memo|thesis)\b/.test(t)) return 'writing';
  if (/\b(lab|prelab|post-?lab)\b/.test(t)) return 'lab';
  if (/\b(quiz)\b/.test(t)) return 'quiz';
  if (/\b(final exam|midterm|exam|test)\b/.test(t)) return 'exam';
  if (/\bfinal\b/.test(t) && !/\b(project|presentation|report|draft)\b/.test(t)) return 'exam';
  if (/\b(problem set|pset|homework|hw|webassign|exercise)\b/.test(t)) return 'problem set';
  if (/\b(read|reading|chapter|response)\b/.test(t)) return 'reading';
  if (/\b(discussion|post|forum|reply)\b/.test(t)) return 'discussion';
  if (/\b(project|presentation|milestone|assignment)\b/.test(t)) return 'project';
  return 'other';
}

// ─── formatting helpers ────────────────────────────────────────────
const fmtDate = d => d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = d => d.toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const pad = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));

/** Monday-anchored week key, so "week of" groupings match how a quarter runs. */
function weekStart(d) {
  const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
  const day = (local.getDay() + 6) % 7;          // Mon=0 … Sun=6
  local.setDate(local.getDate() - day);
  local.setHours(0, 0, 0, 0);
  return local;
}

const C = process.stdout.isTTY
  ? { dim: s => `\x1b[2m${s}\x1b[0m`, b: s => `\x1b[1m${s}\x1b[0m`,
      amber: s => `\x1b[33m${s}\x1b[0m`, red: s => `\x1b[31m${s}\x1b[0m`,
      cyan: s => `\x1b[36m${s}\x1b[0m` }
  : { dim: s => s, b: s => s, amber: s => s, red: s => s, cyan: s => s };

// ─── main ──────────────────────────────────────────────────────────
async function loadSource(src) {
  if (/^https?:\/\//i.test(src)) {
    // Canvas feed URLs are http:// by default — upgrade to https.
    const url = src.replace(/^http:/i, 'https:');
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Canvas returned HTTP ${res.status}. Double-check the feed URL.`);
    return res.text();
  }
  if (!fs.existsSync(src)) throw new Error(`No such file: ${src}`);
  return fs.readFileSync(src, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter(a => a.startsWith('--')));
  const src = args.find(a => !a.startsWith('--'));

  if (!src) {
    console.log(`
${C.b('Quarterly — Canvas feed reader')}

  node read-feed.js "<your Canvas calendar feed URL>"
  node read-feed.js sample-feed.ics
  node read-feed.js <source> --all     include non-assignment events
  node read-feed.js <source> --json    machine-readable output

Get your URL from Canvas → Calendar → "Calendar Feed" in the right sidebar.
`);
    process.exit(1);
  }

  let raw;
  try { raw = await loadSource(src); }
  catch (e) { console.error(C.red('\n  Could not load the feed: ') + e.message + '\n'); process.exit(1); }

  if (!/BEGIN:VCALENDAR/i.test(raw)) {
    console.error(C.red('\n  That URL did not return a calendar file.') +
      '\n  Make sure you copied the "Calendar Feed" link, not the Canvas calendar page URL.\n');
    process.exit(1);
  }

  const all = parseICS(raw).map(interpret).filter(e => e.due);
  const items = flags.has('--all') ? all : all.filter(e => e.isAssignment);
  items.sort((a, b) => a.due - b.due);

  if (flags.has('--json')) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  const now = new Date();
  const upcoming = items.filter(e => e.due >= now);
  const past = items.filter(e => e.due < now);

  console.log('');
  console.log(C.b('  Your Canvas feed'));
  console.log(C.dim(`  ${all.length} calendar items · ${items.length} assignments · ` +
                    `${upcoming.length} still upcoming`));
  console.log('');

  if (!items.length) {
    console.log(C.amber('  No assignments found.'));
    console.log(C.dim('  If it is between quarters this is expected — the feed only carries'));
    console.log(C.dim('  30 days back and 366 forward. Try --all to see every event type.\n'));
    return;
  }

  // ── by course ───────────────────────────────────────────────────
  const byCourse = new Map();
  for (const e of items) {
    if (!byCourse.has(e.courseShort)) byCourse.set(e.courseShort, []);
    byCourse.get(e.courseShort).push(e);
  }

  console.log(C.b('  BY COURSE'));
  console.log(C.dim('  ' + '─'.repeat(64)));
  for (const [course, list] of [...byCourse].sort((a, b) => b[1].length - a[1].length)) {
    const up = list.filter(e => e.due >= now).length;
    const kinds = [...new Set(list.map(e => e.kind))].filter(k => k !== 'other');
    console.log(`  ${C.cyan(pad(course, 16))} ${String(list.length).padStart(3)} items` +
                C.dim(`  ${String(up).padStart(3)} upcoming   ${kinds.slice(0, 4).join(', ')}`));
  }
  console.log('');

  // ── the next two weeks, day by day ──────────────────────────────
  const horizon = new Date(now.getTime() + 14 * 864e5);
  const next = upcoming.filter(e => e.due <= horizon);

  console.log(C.b('  NEXT 14 DAYS'));
  console.log(C.dim('  ' + '─'.repeat(64)));
  if (!next.length) {
    console.log(C.dim('  Nothing due in the next two weeks.'));
  } else {
    let lastDay = '';
    for (const e of next) {
      const day = fmtDate(e.due);
      if (day !== lastDay) { console.log(''); console.log('  ' + C.b(day)); lastDay = day; }
      const when = e.allDay ? C.dim('all day') : C.dim(fmtTime(e.due).padStart(8));
      console.log(`    ${when}  ${C.cyan(pad(e.courseShort, 11))} ${pad(e.title, 34)} ${C.dim(e.kind)}`);
    }
  }
  console.log('');

  // ── workload by week — the first real insight the product gives ──
  const byWeek = new Map();
  for (const e of upcoming) {
    const k = weekStart(e.due).getTime();
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k).push(e);
  }
  const weeks = [...byWeek].sort((a, b) => a[0] - b[0]).slice(0, 11);

  if (weeks.length) {
    const peak = Math.max(...weeks.map(w => w[1].length));
    console.log(C.b('  WORKLOAD BY WEEK') + C.dim('   ← this is the shape of your quarter'));
    console.log(C.dim('  ' + '─'.repeat(64)));
    for (const [ts, list] of weeks) {
      const label = new Date(+ts).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
      const bar = '█'.repeat(Math.max(1, Math.round(list.length / peak * 28)));
      const hasExam = list.some(e => e.kind === 'exam');
      const painted = hasExam ? C.red(bar) : C.amber(bar);
      console.log(`  ${C.dim('wk of')} ${label.padEnd(7)} ${painted} ${String(list.length).padStart(2)}` +
                  (hasExam ? C.red('  ← exam') : ''));
    }
    console.log('');
    console.log(C.dim('  The tall bars are the weeks students lose. Work backward from those.'));
  }

  if (past.length) console.log(C.dim(`\n  (${past.length} past items hidden)`));
  console.log('');
}

main().catch(e => { console.error(C.red('\n  Unexpected error: ') + e.message + '\n'); process.exit(1); });
