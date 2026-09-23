#!/usr/bin/env node
/**
 * Screenshots every screen and state, in both themes, at 390px and 1280px.
 *
 *   node docs/ui-review/capture.mjs <out-dir> [--base http://localhost:3100] [--only name,name]
 *
 * Needs a running `next dev` and Google Chrome. No dependencies: it drives
 * headless Chrome over the DevTools protocol with Node's built-in WebSocket.
 *
 * The clock is pinned. Every page load starts at Wednesday 23 September 2026,
 * 1:40pm Pacific, plus whatever offset the scenario asks for, so a before and
 * an after set taken hours apart still show the same week and the same "now".
 *
 * State is seeded through the app's own screens (/start, /setup, the add
 * sheet, the replan button), not written by hand, and saved to
 * <out-dir>/../seeds/ so the after set replays exactly the same data.
 */

import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const outDir = resolve(args[0] ?? 'docs/ui-review/shots');
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:3100';
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const seedDir = join(dirname(outDir), 'seeds');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9339;
const T0 = Date.parse('2026-09-23T13:40:00-07:00');
const HOUR = 3_600_000;
const TODAY = '2026-09-23';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// A minimal CDP client.

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} ${msg.error.data ?? ''}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  once(method, sessionId, timeout = 30_000) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { off(); resolve(null); }, timeout);
      const l = (msg) => {
        if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
          clearTimeout(t); off(); resolve(msg.params);
        }
      };
      const off = () => { this.listeners = this.listeners.filter((x) => x !== l); };
      this.listeners.push(l);
    });
  }
}

// ---------------------------------------------------------------------------
// One page, with the helpers the scenarios need.

class Page {
  constructor(cdp, sessionId) { this.cdp = cdp; this.s = sessionId; this.clockScript = null; }
  send(m, p) { return this.cdp.send(m, p, this.s); }

  async setClock(offsetMs) {
    if (this.clockScript) await this.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.clockScript });
    const at = T0 + offsetMs;
    const { identifier } = await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(() => {
        const R = Date, real0 = R.now(), shift = ${at} - real0;
        function D(...a) {
          if (!new.target) return new R(R.now() + shift).toString();
          return a.length === 0 ? new R(R.now() + shift) : new R(...a);
        }
        D.prototype = R.prototype;
        D.now = () => R.now() + shift;
        D.parse = R.parse; D.UTC = R.UTC;
        globalThis.Date = D;
      })();
      // The Next dev badge is not part of the product.
      document.addEventListener('DOMContentLoaded', () => {
        const s = document.createElement('style');
        s.textContent = 'nextjs-portal{display:none!important}';
        document.head.appendChild(s);
      });`,
    });
    this.clockScript = identifier;
  }

  async viewport(width, theme, height) {
    const mobile = width < 768;
    await this.send('Emulation.setDeviceMetricsOverride', {
      width, height: height ?? (mobile ? 844 : 900), deviceScaleFactor: mobile ? 2 : 1, mobile,
    });
    await this.send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'no-preference' }],
    });
  }

  async goto(path, settle = 900) {
    const loaded = this.cdp.once('Page.loadEventFired', this.s, 60_000);
    await this.send('Page.navigate', { url: base + path });
    await loaded;
    await sleep(settle);
  }

  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}\n${expr}`);
    return r.result.value;
  }

  /** Click the first button or link whose visible text or aria-label matches. */
  async click(text, { exact = true } = {}) {
    const ok = await this.eval(`(() => {
      const want = ${JSON.stringify(text)};
      const els = [...document.querySelectorAll('button, a, [role=button], label')];
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const el = els.find((e) => {
        const t = norm(e.innerText), a = norm(e.getAttribute('aria-label'));
        return ${exact} ? (t === want || a === want) : (t.includes(want) || a.includes(want));
      });
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    })()`);
    if (!ok) throw new Error(`nothing to click: ${text}`);
    await sleep(250);
  }

  /** Type into an input found by selector, the way a keyboard would. */
  async type(selector, text) {
    await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select?.(); })()`);
    await this.send('Input.insertText', { text });
    await sleep(80);
  }

  /** Set a date, time or number input through React's own setter. */
  async set(selector, value, nth = 0) {
    const ok = await this.eval(`(() => {
      const el = document.querySelectorAll(${JSON.stringify(selector)})[${nth}];
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
    if (!ok) throw new Error(`no input: ${selector}[${nth}]`);
    await sleep(80);
  }

  async screenshot(file, { full = true } = {}) {
    if (full) {
      // Grow the viewport to the whole page first, so fixed chrome (the tab
      // bar, the +) sits at the bottom of the image rather than across the
      // middle of it.
      const m = await this.send('Page.getLayoutMetrics');
      const h = Math.min(Math.ceil(m.cssContentSize.height), 12_000);
      const w = Math.ceil(m.cssLayoutViewport.clientWidth);
      const mobile = w < 768;
      await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await sleep(250);
      const shot = await this.send('Page.captureScreenshot', { format: 'webp', quality: 82 });
      await this.send('Emulation.setDeviceMetricsOverride', { width: w, height: mobile ? 844 : 900, deviceScaleFactor: mobile ? 2 : 1, mobile });
      await writeFile(file, Buffer.from(shot.data, 'base64'));
    } else {
      const shot = await this.send('Page.captureScreenshot', { format: 'webp', quality: 82 });
      await writeFile(file, Buffer.from(shot.data, 'base64'));
    }
  }
}

// ---------------------------------------------------------------------------
// Seeding, through the app.

const STORE_KEYS = ['quarterly.state.v1', 'heron.theme', 'heron.rescue.v1'];

async function clearStorage(page) {
  await page.goto('/privacy', 300);
  await page.eval(`localStorage.clear(); sessionStorage.clear(); true`);
}

async function loadSeed(page, seed) {
  await clearStorage(page);
  if (seed === 'fresh') return;
  const json = await readFile(join(seedDir, `${seed}.json`), 'utf8');
  await page.eval(`(() => { const s = ${json}; for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); return true; })()`);
}

async function saveSeed(page, name) {
  const data = await page.eval(`(() => {
    const out = {};
    for (const k of ${JSON.stringify(STORE_KEYS)}) { const v = localStorage.getItem(k); if (v !== null) out[k] = v; }
    return out;
  })()`);
  await writeFile(join(seedDir, `${name}.json`), JSON.stringify(data, null, 1));
}

async function seed(page) {
  await mkdir(seedDir, { recursive: true });
  await page.setClock(0);
  await page.viewport(1280, 'light');

  // 1. The two-question first run, exactly as a new student does it.
  await clearStorage(page);
  await page.goto('/start', 1500);
  await page.click('Study for a class');
  await page.click('Plan my week');
  await sleep(1500);
  await saveSeed(page, 'starter');

  // 2. A real week: a job, two weekly commitments, three deadlines, one
  //    appointment, one block already done.
  await page.goto('/setup', 1500);
  await page.type('input[placeholder="Masons Supply Co"]', 'Campus job');
  await page.set('input[type=time]', '12:00', 2);
  await page.set('input[type=time]', '16:00', 3);
  for (const d of ['Mon', 'Wed', 'Fri']) await page.click(d);
  await page.click('Save these hours');

  await page.type('input[placeholder="Run 3 miles"]', 'Run');
  await page.set('input[type=number][max="240"]', '40');
  await page.click('Add');
  await page.type('input[placeholder="Run 3 miles"]', 'Capstone project');
  await page.set('input[type=number][max="14"]', '2');
  await page.set('input[type=number][max="240"]', '90');
  await page.click('project');
  await page.click('Add');
  await page.click('Plan my week');
  await sleep(1500);

  const tasks = [
    { title: 'Problem set 4', course: 'MATH 126', due: '2026-09-25', mins: '120' },
    { title: 'Lab report 2', course: 'CHEM 142', due: '2026-09-28', mins: '180' },
    { title: 'Essay draft', course: 'ENGL 131', due: '2026-09-30', mins: '240' },
  ];
  for (const t of tasks) {
    await page.click('Add an event or task');
    await page.click('Needs doing by');
    await page.type('input[aria-label="Task name"]', t.title);
    await page.type('input[aria-label="Course or label"]', t.course);
    await page.set('[role=dialog] input[type=date]', t.due);
    await page.set('[role=dialog] input[type=time]', '23:59');
    await page.set('[role=dialog] input[type=number]', t.mins);
    await page.click('Add task');
    await sleep(300);
  }

  await page.click('Add an event or task');
  await page.type('input[aria-label="Event name"]', 'Dentist');
  await page.set('[role=dialog] input[type=date]', '2026-09-24');
  await page.set('[role=dialog] input[type=time]', '10:00');
  await page.set('[role=dialog] input[type=number]', '60');
  await page.click('Add event');
  await sleep(600);

  await page.click('Replan from now');
  await sleep(1200);

  // Mark the first block done, so the week shows a settled block.
  await page.click('List');
  await sleep(400);
  await page.click('Done');
  await sleep(600);
  await saveSeed(page, 'full');
}

// ---------------------------------------------------------------------------
// What gets captured. Every scenario runs at both widths in both themes.

const SCENARIOS = [
  { name: 'landing', seed: 'fresh', path: '/' },
  { name: 'start', seed: 'fresh', path: '/start' },
  { name: 'start-picked', seed: 'fresh', path: '/start', act: async (p) => { await p.click('Study for a class'); } },
  { name: 'import', seed: 'full', path: '/import' },
  {
    name: 'import-error', seed: 'full', path: '/import',
    act: async (p) => {
      await p.type('input[type=url]', 'https://example.com/calendar.ics');
      await p.eval(`document.querySelector('form button[type=submit]').click(), true`);
      await sleep(2500);
    },
  },
  { name: 'setup', seed: 'full', path: '/setup' },
  { name: 'setup-empty', seed: 'fresh', path: '/setup' },
  { name: 'week-empty', seed: 'fresh', path: '/week' },
  { name: 'week-first-run', seed: 'starter', path: '/week' },
  { name: 'week', seed: 'full', path: '/week' },
  { name: 'week-list', seed: 'full', path: '/week', act: async (p) => { await p.click('List'); } },
  { name: 'week-calendar', seed: 'full', path: '/week', act: async (p) => { await p.click('Calendar'); } },
  { name: 'week-block-open', seed: 'full', path: '/week', act: async (p) => {
      await p.click('Calendar');
      await p.eval(`(() => { const b = [...document.querySelectorAll('[data-block-id]')].find((e) => !e.className.includes('opacity')); b.click(); return true; })()`);
    } },
  { name: 'month', seed: 'full', path: '/week', act: async (p) => { await p.click('Month'); } },
  { name: 'week-add-sheet', seed: 'full', path: '/week', act: async (p) => { await p.click('Add an event or task'); } },
  { name: 'bad-week-lapse', seed: 'full', path: '/week', clock: 30 * HOUR + 20 * 60_000 },
  { name: 'bad-week-away', seed: 'full', path: '/week', clock: 5 * 24 * HOUR },
  { name: 'day', seed: 'full', path: `/day/${TODAY}` },
  { name: 'day-empty', seed: 'fresh', path: `/day/${TODAY}` },
  { name: 'settings', seed: 'full', path: '/settings' },
  { name: 'privacy', seed: 'fresh', path: '/privacy' },
  { name: 'welcome', seed: 'fresh', path: '/welcome' },
  { name: 'onboarding', seed: 'fresh', path: '/onboarding' },
  // What arrives before JavaScript runs: the server-rendered loading state.
  { name: 'week-loading', seed: 'full', path: '/week', noJs: true },
];

const WIDTHS = [390, 1280];
const THEMES = ['light', 'dark'];

// ---------------------------------------------------------------------------

async function main() {
  await mkdir(outDir, { recursive: true });
  const profile = join(tmpdir(), `heron-capture-${process.pid}`);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu',
    '--force-color-profile=srgb', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let version;
    for (let i = 0; i < 50 && !version; i++) {
      try { version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); }
    }
    if (!version) throw new Error('Chrome did not start');

    const cdp = await CDP.connect(version.webSocketDebuggerUrl);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(cdp, sessionId);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });

    if (!existsSync(join(seedDir, 'full.json')) || args.includes('--reseed')) {
      console.log('seeding through the app…');
      await seed(page);
    }

    for (const sc of SCENARIOS) {
      if (only && !only.has(sc.name)) continue;
      for (const width of WIDTHS) {
        for (const theme of THEMES) {
          const file = join(outDir, `${sc.name}--${width}--${theme}.webp`);
          try {
            await page.setClock(sc.clock ?? 0);
            await page.viewport(width, theme);
            await loadSeed(page, sc.seed);
            await page.send('Emulation.setScriptExecutionDisabled', { value: !!sc.noJs });
            await page.goto(sc.path, sc.noJs ? 400 : 1400);
            if (sc.act) { await sc.act(page); await sleep(900); }
            // The first screen, which is what a student between classes sees,
            // and then the whole page.
            await page.screenshot(file.replace('.webp', '--fold.webp'), { full: false });
            await page.screenshot(file);
            await page.send('Emulation.setScriptExecutionDisabled', { value: false });
            console.log('ok ', file.replace(outDir + '/', ''));
          } catch (err) {
            await page.send('Emulation.setScriptExecutionDisabled', { value: false }).catch(() => {});
            console.log('ERR', file.replace(outDir + '/', ''), String(err.message).split('\n')[0]);
          }
        }
      }
    }
    cdp.ws.close();
  } finally {
    chrome.kill();
    await sleep(300);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
