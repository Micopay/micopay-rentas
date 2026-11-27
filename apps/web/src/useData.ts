import { useCallback, useEffect, useRef, useState } from 'react';

/** Tiny loader: data, loading (first load only), error and a reload callback. Reloads keep the current data visible. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);
  const reload = useCallback(() => {
    setError(null);
    if (!loaded.current) setLoading(true);
    load().then((d) => { loaded.current = true; setData(d); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(reload, [reload]);
  return { data, loading, error, reload };
}
