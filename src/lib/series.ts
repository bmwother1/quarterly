/**
 * Colours that identify a course or a commitment.
 *
 * These were picked by eye and failed a colourblind check: the original pink
 * and green sat at ΔE 4.9 under deuteranopia, well under the ≥8 target, which
 * means roughly one man in twelve could not tell two of their courses apart.
 * This order is validated in both modes — worst adjacent CVD ΔE 9.1 light and
 * 8.4 dark, worst normal-vision ΔE 19.6 light and 19.3 dark.
 *
 * Two rules that keep it valid:
 *
 *   1. Assign in fixed order, never cycled by index-modulo into new hues. A
 *      ninth course reuses slot 1 rather than inventing a colour that is
 *      indistinguishable from an existing one under CVD.
 *   2. Colour follows the entity, not its position in a filtered list. Dropping
 *      a course must not repaint the others.
 *
 * Three of the light steps fall below 3:1 against a light surface, so anything
 * built from them carries a visible label — colour is never the only encoding.
 */

export interface SeriesColor {
  light: string;
  dark: string;
}

export const SERIES: SeriesColor[] = [
  { light: '#2a78d6', dark: '#3987e5' },   // blue
  { light: '#eb6834', dark: '#d95926' },   // orange
  { light: '#1baf7a', dark: '#199e70' },   // aqua
  { light: '#eda100', dark: '#c98500' },   // yellow
  { light: '#e87ba4', dark: '#d55181' },   // magenta
  { light: '#008300', dark: '#008300' },   // green
  { light: '#4a3aa7', dark: '#9085e9' },   // violet
  { light: '#e34948', dark: '#e66767' },   // red
];

/**
 * The colour for the nth distinct entity.
 *
 * Stored as a CSS variable reference rather than a hex, so the same stored
 * value resolves correctly in either mode. A commitment created in dark mode
 * shouldn't be stuck with a dark-mode hex forever.
 */
export function seriesVar(index: number): string {
  return `var(--series-${(index % SERIES.length) + 1})`;
}

/** The custom properties both themes need. Emitted once, in globals.css. */
export function seriesTokens(mode: 'light' | 'dark'): string {
  return SERIES.map((c, i) => `  --series-${i + 1}: ${c[mode]};`).join('\n');
}

/**
 * Time that isn't a course or a commitment. Deliberately outside the
 * categorical set: these are context, not series, and shouldn't compete with
 * the things the student is choosing between.
 */
export const CONTEXT_COLORS = {
  sleep: 'var(--ctx-sleep)',
  work: 'var(--ctx-fixed)',
  class: 'var(--ctx-fixed)',
  commitment: 'var(--ctx-fixed)',
  free: 'var(--ctx-free)',
} as const;
