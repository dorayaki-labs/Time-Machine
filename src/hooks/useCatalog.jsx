import { createContext, useContext, useEffect, useState } from 'react';
import { loadCatalog, reloadCatalog, refreshArchiveIfStale } from '@/lib/catalog.js';

const CatalogContext = createContext({ ready: false, error: null });

/**
 * Loads the archive once at the root of the app. Pages read the catalogue
 * through the synchronous getters in lib/catalog.js and render only once the
 * data is in place.
 *
 * Freshness: because archive JSON commits no longer redeploy the site, the
 * browser checks (on tab focus / return to visibility, at most once a
 * minute) whether the repository HEAD moved since the data on screen was
 * loaded. If it did, the catalogue is rebuilt from raw.githubusercontent.com
 * and `version` is bumped — which re-renders every page with the new data.
 */
export function CatalogProvider({ children }) {
  const [status, setStatus] = useState({ ready: false, error: null, version: 0 });

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then(() => active && setStatus((s) => ({ ready: true, error: null, version: s.version })))
      .catch((error) => active && setStatus({ ready: false, error, version: 0 }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let busy = false;
    let lastCheck = 0;

    const check = async () => {
      if (busy || document.visibilityState !== 'visible') return;
      // Never hammer the API: one freshness check per focus, min 60s apart.
      if (Date.now() - lastCheck < 60_000) return;
      lastCheck = Date.now();
      busy = true;
      try {
        if (await refreshArchiveIfStale()) {
          await reloadCatalog();
          setStatus((s) => ({ ready: true, error: null, version: s.version + 1 }));
        }
      } catch { /* stay on the data we already have */ }
      finally { busy = false; }
    };

    const onFocus = () => { check(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <CatalogContext.Provider value={status}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
