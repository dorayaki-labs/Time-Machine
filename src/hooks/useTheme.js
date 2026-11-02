import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tm-theme';
export const THEMES = { light: 'light', dark: 'dark' };

const themeColor = { light: '#f4f1ea', dark: '#151a22' };

function initialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === THEMES.light || stored === THEMES.dark) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEMES.dark : THEMES.light;
}

/**
 * Light and dark themes. The saved preference (or the OS setting) is applied
 * by an inline script in index.html before first paint; this hook keeps the
 * attribute, the storage entry and the browser UI colour in sync afterwards.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor[theme]);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === THEMES.dark ? THEMES.light : THEMES.dark));
  }, []);

  return { theme, toggle };
}
