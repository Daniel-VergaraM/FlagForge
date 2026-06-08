import { useEffect, useState } from 'react';
import { useFlagForge } from '../provider';

export interface FlagEntry {
  key: string;
  enabled: boolean;
  value: string | undefined;
}

export function useFlags(): { flags: FlagEntry[]; loading: boolean; error: Error | null } {
  const { client } = useFlagForge();
  const [state, setState] = useState<{
    flags: FlagEntry[];
    loading: boolean;
    error: Error | null;
  }>({ flags: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        // SDK client does not expose list() yet; return empty.
        if (!cancelled) {
          setState({ flags: [], loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: err as Error }));
        }
      }
    };

    load();
  }, [client]);

  return state;
}
