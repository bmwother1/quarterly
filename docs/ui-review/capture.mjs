#!/usr/bin/env node
/**
 * Screenshots every screen and state, in both themes, at 390px and 1280px.
 *
 *   node docs/ui-review/capture.mjs <out-dir> [--base http://localhost:3100] [--only name,name] [--checks]
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
      await p.eval(`(() => { const all = [...document.querySelectorAll('[data-block-id]')];
      const b = all.find((e) => e.dataset.status === 'planned') ?? all.find((e) => !e.className.includes('opacity'));
      b.click(); return true; })()`);
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
// Checks: `--checks` runs these instead of taking screenshots, and writes
// <out-dir>/checks.json.

/**
 * Every visible run of text on the page against WCAG AA: 4.5:1, or 3:1 for
 * large text. Colours are resolved by painting them into a canvas pixel,
 * because computed styles come back as oklab() and color-mix() that no
 * formula here could parse. The background is composited up the ancestor
 * chain, and an element's opacity is folded into its text colour, which is
 * the case that caught done blocks at 45% before.
 *
 * Skipped: disabled controls (exempt), anything aria-hidden (decorative),
 * and screen-reader-only text.
 */
const CONTRAST_SCAN = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const pageBg = rgba(getComputedStyle(document.body).backgroundColor);

  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let acc = pageBg;
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    return acc;
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    return o;
  };

  const fails = []; let checked = 0;
  const all = document.body.querySelectorAll('*');
  for (const el of all) {
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) continue;
    if (el.closest('[aria-hidden="true"], nextjs-portal, script, style, noscript')) continue;
    if (el.closest('button:disabled, input:disabled, select:disabled, textarea:disabled')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (cs.position === 'absolute' && cs.clip && cs.clip !== 'auto') continue;
    const fg = rgba(cs.color); fg[3] *= opacityOf(el);
    const bg = bgOf(el);
    const shown = over(fg, bg);
    const cr = ratio(shown, bg);
    const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    checked++;
    if (cr < need - 0.01) {
      fails.push({ text: own.slice(0, 48), ratio: +cr.toFixed(2), need, size, fg: shown.slice(0, 3).map(Math.round), bg: bg.slice(0, 3).map(Math.round), el: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').slice(0, 3).join('.') });
    }
  }
  return { checked, fails };
})()`;

async function runChecks(page) {
  const out = { scannerSelfTest: null, overflow375: [], contrast: [], perf: null };

  // 0. The contrast scanner has to catch what it claims to. Two planted
  //    failures: the old --faint grey as text, and ink at 45% opacity, which
  //    is how done blocks used to be drawn. Both must come back as failing.
  await page.setClock(0);
  await page.viewport(390, 'light');
  await loadSeed(page, 'fresh');
  await page.goto('/privacy', 800);
  await page.eval(`(() => {
    const a = document.createElement('p'); a.textContent = 'probe-faint'; a.style.color = '#97918a';
    const b = document.createElement('p'); b.textContent = 'probe-opacity'; b.style.opacity = '0.45';
    document.querySelector('main').prepend(a, b); return true;
  })()`);
  const probe = await page.eval(CONTRAST_SCAN);
  const caught = probe.fails.filter((f) => f.text.startsWith('probe-')).map((f) => `${f.text} ${f.ratio}:1`);
  out.scannerSelfTest = { planted: 2, caught, ok: caught.length === 2 };
  console.log('self', JSON.stringify(out.scannerSelfTest));

  // 1. No horizontal scroll at 375px, on every screen and state.
  for (const sc of SCENARIOS) {
    if (only && !only.has(sc.name)) continue;
    await page.setClock(sc.clock ?? 0);
    await page.viewport(375, 'light', 812);
    await loadSeed(page, sc.seed);
    await page.send('Emulation.setScriptExecutionDisabled', { value: !!sc.noJs });
    await page.goto(sc.path, sc.noJs ? 400 : 1400);
    if (sc.act) { await sc.act(page).catch(() => {}); await sleep(600); }
    const o = await page.eval(`({ scroll: document.documentElement.scrollWidth, view: window.innerWidth })`);
    await page.send('Emulation.setScriptExecutionDisabled', { value: false });
    out.overflow375.push({ name: sc.name, ...o, overflows: o.scroll > o.view + 1 });
    console.log('375 ', sc.name, o.scroll > o.view + 1 ? `OVERFLOW ${o.scroll}px` : 'ok');
  }

  // 2. Contrast, every screen, both themes, phone and laptop.
  for (const sc of SCENARIOS) {
    if (only && !only.has(sc.name)) continue;
    if (sc.noJs) continue;
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        await page.setClock(sc.clock ?? 0);
        await page.viewport(width, theme);
        await loadSeed(page, sc.seed);
        await page.goto(sc.path, 1400);
        if (sc.act) { await sc.act(page).catch(() => {}); await sleep(900); }
        const r = await page.eval(CONTRAST_SCAN);
        out.contrast.push({ name: sc.name, width, theme, checked: r.checked, fails: r.fails });
        console.log('AA  ', sc.name, width, theme, `${r.checked} checked, ${r.fails.length} below AA`);
      }
    }
  }

  // 3. The week on a throttled phone: 4x CPU slowdown and a slow 4G link.
  //    Layout shift and paint timings are read from the page's own
  //    performance observers.
  //    Twice: a cold first visit with no service worker and an empty cache,
  //    and a warm one, which is what an installed app opening from the home
  //    screen gets.
  out.perf = {};
  for (const visit of ['cold', 'warm']) {
  await page.setClock(0);
  await page.viewport(390, 'light');
  await loadSeed(page, 'full');
  await page.send('Network.enable');
  if (visit === 'cold') {
    await page.send('Storage.clearDataForOrigin', { origin: base, storageTypes: 'service_workers,cache_storage' });
    await page.send('Network.clearBrowserCache');
  }
  await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  const { identifier } = await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__cls = 0; window.__lcp = 0; window.__shifts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; window.__shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map((s) => s.node && s.node.nodeName + '.' + String(s.node.className || '').split(' ')[0]) }); } }).observe({ type: 'layout-shift', buffered: true });
      window.__lcpEl = '';
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lcp = e.startTime; window.__lcpEl = e.element ? e.element.nodeName + ' "' + (e.element.textContent || '').trim().slice(0, 40) + '"' : e.url; } }).observe({ type: 'largest-contentful-paint', buffered: true });
      // When the real week (not a placeholder) is in the page and painted:
      // the first block's reason, which both old and new layouts render.
      window.__entered = 0;
      (function poll() {
        const rows = document.querySelectorAll('.enter');
        if (rows.length && [...rows].every((r) => r.getAnimations().every((a) => a.playState === 'finished'))) {
          window.__entered = performance.now(); return;
        }
        requestAnimationFrame(poll);
      })();
      if (${JSON.stringify(process.env.SKIP_ENTRANCE === '1')}) sessionStorage.setItem('heron.week.entered', '1');
      window.__content = 0;
      new MutationObserver((_, obs) => {
        if (window.__content) return obs.disconnect();
        const h = [...document.querySelectorAll('h1')].find((e) => e.textContent.trim() === 'This week');
        if (h) requestAnimationFrame(() => { window.__content = performance.now(); });
      }).observe(document, { childList: true, subtree: true });`,
  });
  // Bytes over the wire, by kind, for this one load.
  const bytes = { script: 0, stylesheet: 0, document: 0, other: 0 };
  const kinds = new Map();
  const onNet = (msg) => {
    if (msg.sessionId !== page.s) return;
    if (msg.method === 'Network.responseReceived') kinds.set(msg.params.requestId, msg.params.type);
    if (msg.method === 'Network.loadingFinished') {
      const k = (kinds.get(msg.params.requestId) ?? 'Other').toLowerCase();
      bytes[k in bytes ? k : 'other'] += msg.params.encodedDataLength;
    }
  };
  page.cdp.listeners.push(onNet);
  const t0 = Date.now();
  await page.goto('/week', 4000);
  page.cdp.listeners = page.cdp.listeners.filter((l) => l !== onNet);
  out.perf[visit] = await page.eval(`({
    cls: +window.__cls.toFixed(4),
    shifts: window.__shifts,
    lcp: Math.round(window.__lcp),
    lcpElement: window.__lcpEl,
    weekOnScreen: Math.round(window.__content),
    entranceDone: Math.round(window.__entered),
    fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0),
    domContentLoaded: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
    heroVisible: !!document.querySelector('section[data-block-id]'),
  })`);
  out.perf[visit].loadToSettledMs = Date.now() - t0;
  out.perf[visit].transferredKB = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)]));
  out.perf[visit].profile = '4x CPU, 1.6 Mbps down, 150ms latency, 390px';
  console.log('perf', visit, JSON.stringify(out.perf[visit]));
  await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await page.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }

  await writeFile(join(outDir, 'checks.json'), JSON.stringify(out, null, 1));
}

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

    if (args.includes('--checks')) {
      await runChecks(page);
      cdp.ws.close();
      return;
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
