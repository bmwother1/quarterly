'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { THEMES, DEFAULT_THEME, cssVars } from '@/lib/themes';

const KEY = 'heron.theme';

let cache: string | null = null;
const listeners = new Set<() => void>();

const themeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  getSnapshot(): string {
    if (cache === null) {
      cache = (typeof window !== 'undefined' && window.localStorage.getItem(KEY)) || DEFAULT_THEME;
    }
    return cache;
  },
  getServerSnapshot: () => DEFAULT_THEME,
  set(id: string) {
    cache = id;
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, id);
    for (const l of listeners) l();
  },
};

export function useTheme() {
  const themeId = useSyncExternalStore(
    themeStore.subscribe, themeStore.getSnapshot, themeStore.getServerSnapshot,
  );
  const setTheme = useCallback((id: string) => themeStore.set(id), []);
  return { themeId, setTheme, themes: THEMES };
}

/**
 * Applies the chosen palette by writing custom properties onto <html>.
 *
 * Written imperatively rather than rendered as a <style> tag so it survives
 * navigation without a flash, and so the OS light/dark preference stays the
 * thing that picks *which* half of the palette applies — a theme choice
 * shouldn't override someone's system setting.
 */
export function ThemeProvider() {
  const { themeId } = useTheme();

  useEffect(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    const root = document.documentElement;

    const apply = (dark: boolean) => {
      const vars = cssVars(dark ? theme.dark : theme.light);
      for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? theme.dark.bg : theme.light.bg);
    };

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [themeId]);

  return null;
}

/** The picker itself. Swatches, because a colour name means nothing. */
export function ThemePicker() {
  const { themeId, setTheme, themes } = useTheme();

  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((t) => {
        const active = t.id === themeId;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            aria-pressed={active}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              active ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--raised)]'
            }`}
          >
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.swatch }} aria-hidden />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
