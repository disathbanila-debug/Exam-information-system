import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

/** Loads `path` on mount (and when it changes). Pass null to skip loading. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });

  const load = useCallback(async () => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await api(path);
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
