// Theme state for the whole site. The saved preference (or the OS setting)
// is applied by an inline script in index.html before first paint; this
// provider keeps the document attribute, the storage entries and the browser
// UI colour in sync afterwards, and backs the Customization Studio.
//
// The active theme is either a built-in palette id ('light', 'dark', …) or
// 'custom:<uuid>' pointing at a theme saved in localStorage. The studio also
// drives a live preview through `preview()` that changes the document
// immediately without touching what is saved — `clearPreview()` puts
// everything back.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BASE_THEMES, isBaseThemeId, themeToStyle, validateSettings, EMPTY_SETTINGS,
} from '@/lib/themeSchema.js';

const STORAGE_KEY = 'tm-theme';
const THEMES_KEY = 'tm-themes';

/** Kept for callers that only want the built-in list (swatches, labels). */
export const THEMES = BASE_THEMES;

const isCustomId = (id) => typeof id === 'string' && id.startsWith('custom:');

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saved custom themes, defensively parsed (a hand-edited entry is skipped). */
function loadCustomThemes() {
  return (readJson(THEMES_KEY) ?? []).filter((t) => t && isCustomId(t.id)
    && isBaseThemeId(t.baseTheme) && typeof t.name === 'string');
}

function initialActiveId(customThemes) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isBaseThemeId(stored)) return stored;
    if (isCustomId(stored) && customThemes.some((t) => t.id === stored)) return stored;
  } catch { /* private mode: fall through to the OS setting */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Feature attributes any theme may set — cleared before each application so
// a value from the previous theme can never linger when the next one leaves
// the setting at its default.
const FEATURE_ATTRS = ['data-grain', 'data-cards-desc', 'data-hover-lift', 'data-motion', 'data-underline-links', 'data-strong-focus'];

/**
 * Writes a resolved theme to the document: base palette attribute, inline
 * token overrides, feature attributes and the browser UI colour. Exported so
 * main.jsx can run it once before React renders (no flash of the wrong
 * layout tokens on boot).
 */
export function applyThemeToDocument({ baseTheme, settings }) {
  const root = document.documentElement;
  root.dataset.theme = baseTheme;
  const { vars, attrs } = themeToStyle({ settings: settings ?? {} });

  // Clear last theme's overrides first so removing a colour in the studio
  // really falls back to the base palette.
  for (const name of [...root.style]) {
    if (name.startsWith('--')) root.style.removeProperty(name);
  }
  for (const name of FEATURE_ATTRS) root.removeAttribute(name);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  for (const [name, value] of Object.entries(attrs)) root.setAttribute(name, value);

  const base = BASE_THEMES.find((t) => t.id === baseTheme);
  const bg = (settings?.colors?.bg && /^#/.test(settings.colors.bg)) ? settings.colors.bg : base?.swatch[0];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** Boot-time application of the saved state (used before first render). */
export function applySavedThemeToDocument() {
  const customThemes = loadCustomThemes();
  const id = initialActiveId(customThemes);
  if (isCustomId(id)) {
    const theme = customThemes.find((t) => t.id === id);
    applyThemeToDocument({ baseTheme: theme.baseTheme, settings: theme.settings });
  } else {
    applyThemeToDocument({ baseTheme: id, settings: {} });
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [customThemes, setCustomThemes] = useState(loadCustomThemes);
  const [activeId, setActiveId] = useState(() => initialActiveId(loadCustomThemes()));
  const [previewing, setPreviewing] = useState(null); // { baseTheme, settings } while the studio edits
  const [storageWarning, setStorageWarning] = useState(null);

  // Resolve what should be on screen right now.
  const resolved = useMemo(() => {
    if (previewing) return { baseTheme: previewing.baseTheme, settings: previewing.settings, preview: true };
    if (isCustomId(activeId)) {
      const theme = customThemes.find((t) => t.id === activeId);
      if (theme) return { baseTheme: theme.baseTheme, settings: theme.settings, theme, preview: false };
    }
    return { baseTheme: isBaseThemeId(activeId) ? activeId : 'light', settings: {}, preview: false };
  }, [previewing, activeId, customThemes]);

  useEffect(() => { applyThemeToDocument(resolved); }, [resolved]);

  const persist = useCallback((nextCustom, nextActiveId) => {
    setCustomThemes(nextCustom);
    setActiveId(nextActiveId);
    try {
      localStorage.setItem(THEMES_KEY, JSON.stringify(nextCustom));
      // The saved pointer always names the saved theme, never a preview.
      if (!previewing) localStorage.setItem(STORAGE_KEY, nextActiveId);
      setStorageWarning(null);
    } catch {
      setStorageWarning('Your browser blocked saving (private mode, or storage is full). Themes work for this visit, but they will be gone after a refresh — export the ones you want to keep.');
    }
  }, [previewing]);

  // While previewing, active-id changes must still persist the pointer.
  useEffect(() => {
    if (previewing) return;
    try { localStorage.setItem(STORAGE_KEY, activeId); } catch { /* handled above */ }
  }, [activeId, previewing]);

  const applyBuiltin = useCallback((id) => {
    if (!isBaseThemeId(id)) return;
    setPreviewing(null);
    persist(customThemes, id);
  }, [customThemes, persist]);

  const applyCustom = useCallback((id) => {
    if (!customThemes.some((t) => t.id === id)) return;
    setPreviewing(null);
    persist(customThemes, id);
  }, [customThemes, persist]);

  /** Studio live editing: change the document now, save nothing. */
  const preview = useCallback((draft) => {
    setPreviewing({ baseTheme: isBaseThemeId(draft.baseTheme) ? draft.baseTheme : 'light', settings: draft.settings ?? {} });
  }, []);

  const clearPreview = useCallback(() => setPreviewing(null), []);

  /** Insert or replace a custom theme and make it the saved active one. */
  const saveTheme = useCallback((theme) => {
    const clean = {
      ...theme,
      name: String(theme.name ?? 'My theme').slice(0, 60),
      settings: validateSettings(theme.settings),
      updatedAt: new Date().toISOString(),
    };
    const next = customThemes.some((t) => t.id === clean.id)
      ? customThemes.map((t) => (t.id === clean.id ? clean : t))
      : [...customThemes, clean];
    setPreviewing(null);
    persist(next, clean.id);
    return clean;
  }, [customThemes, persist]);

  const deleteTheme = useCallback((id) => {
    const next = customThemes.filter((t) => t.id !== id);
    const fallback = isCustomId(activeId) && activeId === id ? 'light' : activeId;
    setPreviewing(null);
    persist(next, fallback);
  }, [customThemes, activeId, persist]);

  const renameTheme = useCallback((id, name) => {
    const next = customThemes.map((t) => (t.id === id
      ? { ...t, name: String(name).slice(0, 60) || t.name, updatedAt: new Date().toISOString() } : t));
    persist(next, activeId);
  }, [customThemes, activeId, persist]);

  const duplicateTheme = useCallback((id) => {
    const source = customThemes.find((t) => t.id === id);
    if (!source) return null;
    const copy = {
      ...structuredClone(source),
      id: `custom:${crypto.randomUUID?.() ?? `f${Date.now()}${Math.random().toString(36).slice(2, 8)}`}`,
      name: `${source.name} (copy)`.slice(0, 60),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist([...customThemes, copy], activeId);
    return copy;
  }, [customThemes, activeId, persist]);

  /** Wipes every saved custom theme and returns to the default look. */
  const resetCustomization = useCallback(() => {
    setPreviewing(null);
    persist([], 'light');
  }, [persist]);

  const value = useMemo(() => ({
    themes: BASE_THEMES,
    customThemes,
    activeId: previewing ? 'preview' : activeId,
    activeTheme: resolved,
    isPreviewing: Boolean(previewing),
    applyBuiltin,
    applyCustom,
    preview,
    clearPreview,
    saveTheme,
    deleteTheme,
    renameTheme,
    duplicateTheme,
    resetCustomization,
    storageWarning,
    emptySettings: EMPTY_SETTINGS,
  }), [customThemes, activeId, previewing, resolved, applyBuiltin, applyCustom, preview,
    clearPreview, saveTheme, deleteTheme, renameTheme, duplicateTheme, resetCustomization, storageWarning]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export default function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
