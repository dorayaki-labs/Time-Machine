import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tm-theme';

/**
 * Every theme is a complete design system: the CSS custom properties for each
 * live in styles/variables.css under :root[data-theme='<id>']. `dark` marks
 * themes that should report color-scheme: dark to the browser.
 */
export const THEMES = [
  { id: 'light', label: 'Light', swatch: ['#f4f1ea', '#2b5d8f'], dark: false },
  { id: 'dark', label: 'Dark', swatch: ['#151a22', '#8fb8e3'], dark: true },
  { id: 'midnight', label: 'Midnight', swatch: ['#0d1220', '#7aa5e8'], dark: true },
  { id: 'sakura', label: 'Sakura', swatch: ['#faf3f4', '#c25574'], dark: false },
  { id: 'ocean', label: 'Ocean', swatch: ['#071824', '#4cc9d9'], dark: true },
  { id: 'forest', label: 'Forest', swatch: ['#10160f', '#93c78e'], dark: true },
  { id: 'amethyst', label: 'Amethyst', swatch: ['#14101d', '#b79aec'], dark: true },
];

export const THEME_IDS = THEMES.map((t) => t.id);
const THEME_COLOR = Object.fromEntries(THEMES.map((t) => [t.id, t.swatch[0]]));

const isThemeId = (value) => THEME_IDS.includes(value);

function initialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (isThemeId(stored)) return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * The saved preference (or the OS setting) is applied by an inline script in
 * index.html before first paint; this hook keeps the attribute, the storage
 * entry and the browser UI colour in sync afterwards.
 */
export default function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  // Kept for the keyboard shortcut in the header (cycles light ↔ dark).
  const toggle = useCallback(() => {
    setTheme((t) => {
      const lightish = t === 'light' || t === 'sakura';
      return lightish ? 'dark' : 'light';
    });
  }, []);

  return { theme, setTheme, toggle, themes: THEMES };
}
