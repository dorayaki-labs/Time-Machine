import { createContext, useContext, useEffect, useState } from 'react';
import { loadCatalog } from '@/lib/catalog.js';

const CatalogContext = createContext({ ready: false, error: null });

/**
 * Loads the archive once at the root of the app. Pages read the catalogue
 * through the synchronous getters in lib/catalog.js and render only once the
 * data is in place.
 */
export function CatalogProvider({ children }) {
  const [status, setStatus] = useState({ ready: false, error: null });

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then(() => active && setStatus({ ready: true, error: null }))
      .catch((error) => active && setStatus({ ready: false, error }));
    return () => { active = false; };
  }, []);

  return <CatalogContext.Provider value={status}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
