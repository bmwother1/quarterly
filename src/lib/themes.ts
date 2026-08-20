/**
 * Colour palettes.
 *
 * Each theme supplies only the tokens that carry identity — accent, surfaces,
 * ink. Everything else in globals.css is derived, so a theme is a short list
 * rather than a second stylesheet to keep in sync.
 *
 * Both modes are defined for every theme. A palette that only works in the light
 * mode is a palette half the users never see: students open this at 11pm as
 * often as at 9am.
 */

export interface ThemeTokens {
  bg: string; surface: string; raised: string;
  border: string; borderStrong: string;
  ink: string; muted: string; faint: string;
  accent: string; accentInk: string; accentSoft: string;
  warn: string;
}

export interface Theme {
  id: string;
  name: string;
  /** Shown in the picker without applying the theme. */
  swatch: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export const THEMES: Theme[] = [
  {
    id: 'ember', name: 'Ember', swatch: '#b4531f',
    light: { bg:'#faf9f7', surface:'#ffffff', raised:'#ffffff', border:'#e6e1db', borderStrong:'#d5cec5',
             ink:'#191714', muted:'#6b645c', faint:'#97918a', accent:'#b4531f', accentInk:'#ffffff', accentSoft:'#fdf2ea', warn:'#c02a1e' },
    dark:  { bg:'#121110', surface:'#1b1917', raised:'#232120', border:'#2e2b28', borderStrong:'#423e3a',
             ink:'#f2eee9', muted:'#a49c93', faint:'#6f675f', accent:'#e0894f', accentInk:'#1a1512', accentSoft:'#251a12', warn:'#f2604a' },
  },
  {
    id: 'ink', name: 'Ink', swatch: '#2563eb',
    light: { bg:'#f8fafc', surface:'#ffffff', raised:'#ffffff', border:'#e2e8f0', borderStrong:'#cbd5e1',
             ink:'#0f172a', muted:'#64748b', faint:'#94a3b8', accent:'#2563eb', accentInk:'#ffffff', accentSoft:'#eff6ff', warn:'#dc2626' },
    dark:  { bg:'#0b1120', surface:'#131c2e', raised:'#1b2639', border:'#25314a', borderStrong:'#3a4a68',
             ink:'#e8eefb', muted:'#94a3b8', faint:'#64748b', accent:'#60a5fa', accentInk:'#0b1120', accentSoft:'#152238', warn:'#f87171' },
  },
  {
    id: 'moss', name: 'Moss', swatch: '#15803d',
    light: { bg:'#f7faf7', surface:'#ffffff', raised:'#ffffff', border:'#dfe8df', borderStrong:'#c6d4c6',
             ink:'#14201a', muted:'#5c6b60', faint:'#8d9a91', accent:'#15803d', accentInk:'#ffffff', accentSoft:'#effbf2', warn:'#c02a1e' },
    dark:  { bg:'#0e1411', surface:'#161e19', raised:'#1e2822', border:'#293530', borderStrong:'#3b4a43',
             ink:'#e9f1ec', muted:'#98a89e', faint:'#65756c', accent:'#4ade80', accentInk:'#0e1411', accentSoft:'#14241a', warn:'#f87171' },
  },
  {
    id: 'plum', name: 'Plum', swatch: '#7c3aed',
    light: { bg:'#faf8fc', surface:'#ffffff', raised:'#ffffff', border:'#e8e2f0', borderStrong:'#d3c9e0',
             ink:'#1b1524', muted:'#665c76', faint:'#968da4', accent:'#7c3aed', accentInk:'#ffffff', accentSoft:'#f5efff', warn:'#c02a1e' },
    dark:  { bg:'#110e17', surface:'#191521', raised:'#221d2c', border:'#2e2839', borderStrong:'#443b53',
             ink:'#efeaf6', muted:'#a599b5', faint:'#6f6580', accent:'#a78bfa', accentInk:'#110e17', accentSoft:'#1e1729', warn:'#f87171' },
  },
  {
    id: 'slate', name: 'Slate', swatch: '#475569',
    light: { bg:'#f8f8f8', surface:'#ffffff', raised:'#ffffff', border:'#e4e4e4', borderStrong:'#cfcfcf',
             ink:'#171717', muted:'#5f5f5f', faint:'#909090', accent:'#404040', accentInk:'#ffffff', accentSoft:'#f0f0f0', warn:'#c02a1e' },
    dark:  { bg:'#101010', surface:'#191919', raised:'#212121', border:'#2b2b2b', borderStrong:'#3f3f3f',
             ink:'#f0f0f0', muted:'#a0a0a0', faint:'#6b6b6b', accent:'#e5e5e5', accentInk:'#101010', accentSoft:'#1f1f1f', warn:'#f2604a' },
  },
];

export const DEFAULT_THEME = 'ember';

/** The CSS custom properties for one theme in one mode. */
export function cssVars(t: ThemeTokens): Record<string, string> {
  return {
    '--bg': t.bg, '--surface': t.surface, '--raised': t.raised,
    '--border': t.border, '--border-strong': t.borderStrong,
    '--ink': t.ink, '--muted': t.muted, '--faint': t.faint,
    '--accent': t.accent, '--accent-ink': t.accentInk, '--accent-soft': t.accentSoft,
    '--warn': t.warn,
  };
}
