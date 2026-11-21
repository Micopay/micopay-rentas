import { useCallback, useEffect, useState } from 'react';

/** Tiny loader: data, loading, error and a reload callback. */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    load().then((d) => { setData(d); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(reload, [reload]);
  return { data, loading, error, reload };
}
