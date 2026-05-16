/*
 * Theme state — three modes:
 *   - 'system'  → follow prefers-color-scheme media query (default)
 *   - 'light'   → force light
 *   - 'dark'    → force dark
 *
 * Applies as `data-theme` attribute on <html>. Persisted to localStorage.
 * Read once at module load so the first paint is right.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'tds.theme';

function readMode(): ThemeMode {
  const stored = localStorage.getItem(KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', mode);
  }
}

// Apply synchronously on script load to prevent FOUC.
apply(readMode());

export const themeState = $state({ mode: readMode() });

export function setTheme(mode: ThemeMode) {
  themeState.mode = mode;
  if (mode === 'system') {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, mode);
  }
  apply(mode);
}

/**
 * Compute the *effective* theme (what's actually shown), used to swap
 * icons in the switcher. Tracks the media query when in 'system' mode.
 */
export function effectiveTheme(): 'light' | 'dark' {
  if (themeState.mode === 'light') return 'light';
  if (themeState.mode === 'dark') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
