/**
 * Validate the category palette, in both modes and under colour vision
 * deficiency.
 *
 * This exists because the last palette was picked by eye and failed. The
 * original course pink and green sat at ΔE 4.9 under deuteranopia, which means
 * roughly one man in twelve could not tell two of their courses apart, and
 * nobody noticed until it was checked properly.
 *
 * A two-axis palette has to satisfy two things at once and they pull against
 * each other:
 *
 *   1. Families must stay apart from each other  (is this a class or a deadline?)
 *   2. Shades must stay apart within a family    (is this CHEM or MATH?)
 *
 * Lightening a shade to separate it from its siblings drags it toward every
 * other family's pale end, so passing one test can fail the other. That is the
 * whole reason this runs rather than being asserted.
 *
 * Run: npm run palette
 */

// ── colour maths ────────────────────────────────────────────────────

type RGB = [number, number, number];

function oklchToRgb(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;

  const lin: RGB = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];

  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  }) as RGB;
}

const hex = (rgb: RGB) =>
  '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

const hexToRgb = (h: string): RGB =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** sRGB to CIE Lab, D65. */
function rgbToLab(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Viénot, Brettel and Mollon 1999. Simpler than full Brettel and accurate
 * enough for the question being asked, which is "can these two be confused".
 */
function simulateCVD(rgb: RGB, kind: 'deuteranopia' | 'protanopia' | 'tritanopia'): RGB {
  const [r, g, b] = rgb.map(toLinear);

  // LMS, Hunt-Pointer-Estevez normalised to D65.
  const Lc = 0.31399022 * r + 0.63951294 * g + 0.04649755 * b;
  const M = 0.15537241 * r + 0.75789446 * g + 0.08670142 * b;
  const S = 0.01775239 * r + 0.10944209 * g + 0.87256922 * b;

  let l = Lc, m = M, s = S;
  if (kind === 'deuteranopia') m = 0.9513092 * Lc + 0.04866992 * S;
  if (kind === 'protanopia') l = 1.05118294 * M - 0.05116099 * S;
  if (kind === 'tritanopia') s = -0.86744736 * Lc + 1.86727089 * M;

  const lin: RGB = [
    +5.47221206 * l - 4.6419601 * m + 0.16963708 * s,
    -1.1252419 * l + 2.29317094 * m - 0.1678952 * s,
    +0.02980165 * l - 0.19318073 * m + 1.16364789 * s,
  ];

  return lin.map((v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, c));
  }) as RGB;
}

/** CIEDE2000. Worth the length: CIE76 badly overstates blue separation. */
function deltaE00(l1: [number, number, number], l2: [number, number, number]): number {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const avgL = (L1 + L2) / 2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const avgCp = (C1p + C2p) / 2;
  const h1p = (Math.atan2(b1, a1p) * 180) / Math.PI + (Math.atan2(b1, a1p) < 0 ? 360 : 0);
  const h2p = (Math.atan2(b2, a2p) * 180) / Math.PI + (Math.atan2(b2, a2p) < 0 ? 360 : 0);
  let dhp = h2p - h1p;
  if (Math.abs(dhp) > 180) dhp -= Math.sign(dhp) * 360;
  const dLp = L2 - L1, dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);
  let avghp = (h1p + h2p) / 2;
  if (Math.abs(h1p - h2p) > 180) avghp += 180;
  const T = 1 - 0.17 * Math.cos(((avghp - 30) * Math.PI) / 180)
    + 0.24 * Math.cos((2 * avghp * Math.PI) / 180)
    + 0.32 * Math.cos(((3 * avghp + 6) * Math.PI) / 180)
    - 0.20 * Math.cos(((4 * avghp - 63) * Math.PI) / 180);
  const SL = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;
  const RT = -2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7))
    * Math.sin((60 * Math.exp(-(((avghp - 275) / 25) ** 2)) * Math.PI) / 180);
  return Math.sqrt(
    (dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH),
  );
}

/**
 * What `color-mix(in srgb, C p%, surface)` actually produces.
 *
 * The week grid paints blocks as a 26% tint with the full colour only as a 3px
 * border. Validating the pure colour therefore says almost nothing about what
 * is on screen: a tint compresses every difference to roughly a quarter of it.
 * Both get tested below.
 */
function mix(c: RGB, bg: RGB, p: number): RGB {
  return c.map((v, i) => v * p + bg[i] * (1 - p)) as RGB;
}

function contrast(a: RGB, b: RGB): number {
  const lum = (c: RGB) => {
    const [r, g, bl] = c.map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ── the palette under test ──────────────────────────────────────────

/**
 * Hue families, separated by lightness as much as by hue.
 *
 * The first attempt gave every family the same lightness ladder and differed
 * them only by hue. It failed 24 ways, because hue is precisely what colour
 * vision deficiency destroys: deuteranopia folded deadline into personal,
 * protanopia folded class into focus, tritanopia folded class into work.
 *
 * So each family now owns a lightness band. When hue collapses, lightness is
 * still there, and that is what keeps six categories apart for everyone.
 *
 * The accent is burnt orange (h≈45), so no family sits near it. A category chip
 * that looks like a button is its own kind of bug.
 */
/*
 * Ordered by lightness, and the hue order is the whole trick: no two families
 * are neighbours on both axes at once. Lightness-adjacent pairs are at least
 * 110° apart in hue, so when CVD folds the hue there is still lightness, and
 * when lightness is close the hue is nowhere near.
 *
 * The three collapses each get handled by a different pair being far apart:
 * deuteranopia and protanopia fold red into green, so deadline and personal sit
 * 0.18 apart in lightness. Tritanopia folds blue into teal, so class and work
 * sit 0.27 apart.
 *
 * `sleep` is a near-neutral grey rather than a hue. Chroma is what separates it,
 * and chroma survives every CVD, which is the right property for the one
 * category that is pure context.
 */
const FAMILIES = {
  deadline: { hue: 25,  chroma: 0.16,  L: 0.44, shades: 4 },
  class:    { hue: 255, chroma: 0.13,  L: 0.53, shades: 4 },
  personal: { hue: 145, chroma: 0.12,  L: 0.62, shades: 2 },
  sleep:    { hue: 250, chroma: 0.008, L: 0.66, shades: 1 },
  focus:    { hue: 315, chroma: 0.13,  L: 0.71, shades: 2 },
  work:     { hue: 185, chroma: 0.13,  L: 0.77, shades: 2 },
} as const;

/**
 * Shades step away from the family's own lightness, in whichever direction has
 * room. A family near the floor steps up, one near the ceiling steps down.
 * Fixed symmetric offsets clipped at both ends and silently produced duplicates.
 *
 * Index 0 is canonical: a student with one course, and every bar in month view,
 * gets the colour the family was actually validated at.
 */
const SHADE_STEP = [0, 0.10, 0.20, 0.30];

/** Dark mode lifts everything: a block on #1b1917 must not sink into it. */
const DARK_LIFT = 0.06;

type Mode = 'light' | 'dark';
const BG: Record<Mode, RGB> = { light: hexToRgb('#ffffff'), dark: hexToRgb('#1b1917') };

function build(mode: Mode) {
  const lift = mode === 'dark' ? DARK_LIFT : 0;
  const out: Array<{ name: string; family: string; shade: number; rgb: RGB; hex: string }> = [];
  for (const [family, spec] of Object.entries(FAMILIES)) {
    for (let i = 0; i < spec.shades; i++) {
      // Away from whichever end is closer, so four shades always fit.
      const dir = spec.L < 0.60 ? 1 : -1;
      const L = Math.min(0.90, Math.max(0.32, spec.L + lift + dir * SHADE_STEP[i]));
      const rgb = oklchToRgb(L, spec.chroma, spec.hue);
      out.push({ name: `${family}.${i}`, family, shade: i, rgb, hex: hex(rgb) });
    }
  }
  return out;
}

const CVD = ['deuteranopia', 'protanopia', 'tritanopia'] as const;
/**
 * Two thresholds, because the axes are never both on screen at full strength.
 *
 * Month view shows one canonical colour per category and no shades at all, so
 * canonical-to-canonical is the strict test: nothing else separates a work day
 * from a deadline day there.
 *
 * Week and day views show shades, but every block carries its course code, and
 * the rule since the last palette is that colour is never the only encoding.
 * There, colour is a scanning aid, so non-canonical pairs only have to avoid
 * being the same colour.
 */
const CANONICAL_MIN = 8;   // category vs category, month view, nothing else to go on
const SHADE_MIN = 6;       // within a family: is this CHEM or MATH
const OFF_CANON_MIN = 3;   // any other pair: labels are doing the work

let failures = 0;

for (const mode of ['light', 'dark'] as Mode[]) {
  const palette = build(mode);
  console.log(`\n${'='.repeat(58)}\n${mode.toUpperCase()}\n${'='.repeat(58)}`);
  console.log(palette.map((p) => `  ${p.name.padEnd(12)} ${p.hex}`).join('\n'));

  const worstFamily = { pair: '', vision: '', dE: Infinity };
  const worstShade = { pair: '', vision: '', dE: Infinity };

  for (const vision of ['normal', ...CVD] as const) {
    const seen = palette.map((p) => ({
      ...p,
      lab: rgbToLab(vision === 'normal' ? p.rgb : simulateCVD(p.rgb, vision)),
    }));

    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        const a = seen[i], b = seen[j];
        const dE = deltaE00(a.lab, b.lab);
        const sameFamily = a.family === b.family;
        const bothCanonical = a.shade === 0 && b.shade === 0;
        const target = sameFamily ? SHADE_MIN : bothCanonical ? CANONICAL_MIN : OFF_CANON_MIN;
        const worst = sameFamily ? worstShade : worstFamily;
        if (!sameFamily && !bothCanonical) {
          // Tracked but not headlined: these never carry meaning alone.
          if (dE < target) {
            failures++;
            console.log(`  FAIL off-canon ${a.name} vs ${b.name}  ΔE ${dE.toFixed(1)} < ${target}  (${vision})`);
          }
          continue;
        }
        if (dE < worst.dE) {
          worst.dE = dE; worst.pair = `${a.name} vs ${b.name}`; worst.vision = vision;
        }
        if (dE < target) {
          failures++;
          console.log(
            `  FAIL ${sameFamily ? 'shade ' : 'family'}  ${a.name} vs ${b.name}` +
            `  ΔE ${dE.toFixed(1)} < ${target}  (${vision})`,
          );
        }
      }
    }
  }

  console.log(`  worst canonical pair: ${worstFamily.pair} ΔE ${worstFamily.dE.toFixed(1)} (${worstFamily.vision})`);
  console.log(`  worst shade pair:  ${worstShade.pair} ΔE ${worstShade.dE.toFixed(1)} (${worstShade.vision})`);

  // What the week grid actually paints: a 26% tint, ink text on top of it.
  const surface = hexToRgb(mode === 'light' ? '#ffffff' : '#1b1917');
  const ink = hexToRgb(mode === 'light' ? '#191714' : '#f2eee9');
  const tinted = palette.map((p) => ({ ...p, rgb: mix(p.rgb, surface, 0.26) }));

  for (const p of tinted) {
    const c = contrast(p.rgb, ink);
    if (c < 4.5) {
      failures++;
      console.log(`  FAIL label   ink on tinted ${p.name}: ${c.toFixed(1)} < 4.5`);
    }
  }

  // Full strength: month bars and day-bar segments are solid, with the label
  // beside them rather than on them. They only have to be visible.
  for (const p of palette) {
    if (contrast(p.rgb, BG[mode]) < 1.6) {
      failures++;
      console.log(`  FAIL bg      ${p.name} vs page ${contrast(p.rgb, BG[mode]).toFixed(2)} < 1.6`);
    }
  }

  // The honest test for the week grid: can two tinted blocks be told apart at
  // all? This is where a palette validated only at full strength falls over.
  let worstTint = { pair: '', vision: '', dE: Infinity };
  for (const vision of ['normal', ...CVD] as const) {
    const seen = tinted.map((p) => ({
      ...p,
      lab: rgbToLab(vision === 'normal' ? p.rgb : simulateCVD(p.rgb, vision)),
    }));
    for (let i = 0; i < seen.length; i++) {
      for (let j = i + 1; j < seen.length; j++) {
        if (seen[i].shade !== 0 || seen[j].shade !== 0) continue;
        const dE = deltaE00(seen[i].lab, seen[j].lab);
        if (dE < worstTint.dE) {
          worstTint = { pair: `${seen[i].name} vs ${seen[j].name}`, vision, dE };
        }
      }
    }
  }
  console.log(`  worst tinted canonical pair: ${worstTint.pair} ΔE ${worstTint.dE.toFixed(1)} (${worstTint.vision})`);
  if (worstTint.dE < 2) {
    failures++;
    console.log(`  FAIL tint    26% tint leaves categories indistinguishable in the week grid`);
  }
}

console.log(failures ? `\n${failures} failures\n` : '\nall checks pass\n');

// ── emit ────────────────────────────────────────────────────────────
// `npm run palette -- --emit` prints the CSS custom properties to paste into
// globals.css. Generated rather than transcribed, because a hex typed by hand
// is a hex nobody validated.
if (process.argv.includes('--emit')) {
  for (const mode of ['light', 'dark'] as Mode[]) {
    console.log(`\n/* ${mode} */`);
    for (const p of build(mode)) {
      console.log(`  --cat-${p.family}-${p.shade}: ${p.hex};`);
    }
  }
}


// ── visual review ───────────────────────────────────────────────────
// `npm run palette -- --html > out.html` renders every colour, every CVD
// simulation, and the two contexts that actually matter: a solid month bar and
// a tinted week block with its border. Numbers say it passes; this says whether
// it looks like anything.
if (process.argv.includes('--html')) {
  const swatch = (c: RGB, label: string, sub = '') =>
    `<div class="sw"><div class="chip" style="background:${hex(c)}"></div>` +
    `<div class="lbl">${label}<span>${sub || hex(c)}</span></div></div>`;

  const section = (mode: Mode) => {
    const pal = build(mode);
    const surface = hexToRgb(mode === 'light' ? '#ffffff' : '#1b1917');
    const canon = pal.filter((p) => p.shade === 0);

    const rows = (['normal', ...CVD] as const).map((v) => {
      const cells = canon.map((p) => {
        const rgb = v === 'normal' ? p.rgb : simulateCVD(p.rgb, v);
        return swatch(rgb, p.family, v === 'normal' ? hex(rgb) : '');
      }).join('');
      return `<div class="rowlabel">${v}</div><div class="row">${cells}</div>`;
    }).join('');

    const ladders = ['deadline', 'class'].map((f) => {
      const cells = pal.filter((p) => p.family === f)
        .map((p) => swatch(p.rgb, `${p.family}.${p.shade}`)).join('');
      return `<div class="rowlabel">${f} shades</div><div class="row">${cells}</div>`;
    }).join('');

    const monthBars = canon.map((p) =>
      `<div class="daycell"><span>${p.family.slice(0, 2)}</span>` +
      `<div class="bar" style="background:${hex(p.rgb)};width:${40 + p.shade * 10 + Math.random() * 45}%"></div></div>`,
    ).join('');

    const weekBlocks = canon.map((p) =>
      `<div class="wblock" style="background:${hex(mix(p.rgb, surface, 0.26))};border-left:3px solid ${hex(p.rgb)}">` +
      `${p.family}</div>`,
    ).join('');

    return `<section class="${mode}">
      <h2>${mode}</h2>
      <div class="grid">${rows}${ladders}</div>
      <h3>month view · solid bar, category only</h3>
      <div class="month">${monthBars}</div>
      <h3>week view · 26% tint with full-strength border</h3>
      <div class="week">${weekBlocks}</div>
    </section>`;
  };

  console.log(`<style>
body{font:13px ui-sans-serif,system-ui;margin:0}
section{padding:20px 24px}
section.light{background:#faf9f7;color:#191714}
section.dark{background:#121110;color:#f2eee9}
h2{margin:0 0 14px;font-size:15px;text-transform:uppercase;letter-spacing:.08em;opacity:.6}
h3{margin:22px 0 8px;font-size:12px;font-weight:500;opacity:.55}
.grid{display:grid;grid-template-columns:90px 1fr;gap:7px 12px;align-items:center}
.rowlabel{font-size:11px;opacity:.5;text-align:right}
.row{display:flex;gap:7px;flex-wrap:wrap}
.sw{display:flex;flex-direction:column;gap:3px;width:76px}
.chip{height:32px;border-radius:5px}
.lbl{font-size:10px;line-height:1.25;opacity:.8}
.lbl span{display:block;opacity:.5;font-family:ui-monospace,monospace}
.month{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;max-width:430px}
.daycell{border:1px solid currentColor;border-radius:5px;padding:5px;height:46px;position:relative;opacity:.85}
.daycell span{font-size:9px;opacity:.5}
.bar{position:absolute;bottom:6px;left:5px;height:5px;border-radius:3px}
.week{display:flex;gap:7px;flex-wrap:wrap}
.wblock{padding:9px 11px;border-radius:4px;font-size:11px;min-width:78px}
</style>${section('light')}${section('dark')}`);
}

process.exit(failures ? 1 : 0);
