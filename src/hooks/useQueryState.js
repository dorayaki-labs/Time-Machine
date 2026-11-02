import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps filter state in the URL query string so filtered views can be shared and survive a refresh.
 * `defaults` lists every key and its default value. Returns [values, update, reset].
 */
export default function useQueryState(defaults) {
  const [params, setParams] = useSearchParams();
  const keys = Object.keys(defaults);

  const values = useMemo(() => {
    const out = {};
    for (const k of keys) out[k] = params.get(k) ?? defaults[k];
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const touchedFilter = Object.keys(patch).some((k) => k !== 'page');
          for (const [k, v] of Object.entries(patch)) {
            if (v === '' || v == null || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          }
          if (touchedFilter && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  return [values, update, reset];
}
