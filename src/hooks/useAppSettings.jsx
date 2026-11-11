import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  APP_SETTINGS_KEY, loadAppSettings, saveAppSettings, defaultAppSettings,
} from '@/lib/appSettings.js';

/**
 * App settings context: loads once from localStorage, keeps every consumer
 * in sync (change the top bar order in Settings and the header re-renders
 * immediately) and persists on every change. A corrupted store silently
 * falls back to the defaults (loadAppSettings validates).
 */
const AppSettingsContext = createContext(null);

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadAppSettings());

  useEffect(() => { saveAppSettings(settings); }, [settings]);

  // Another tab changed the settings: follow along.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === APP_SETTINGS_KEY) setSettings(loadAppSettings());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const resetAll = useCallback(() => setSettings(defaultAppSettings()), []);

  const value = useMemo(
    () => ({ settings, update, resetAll }),
    [settings, update, resetAll],
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    // Used outside the provider (should not happen): fall back to defaults
    // rather than crash the header.
    return { settings: defaultAppSettings(), update: () => {}, resetAll: () => {} };
  }
  return ctx;
}
