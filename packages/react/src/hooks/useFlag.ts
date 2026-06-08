import { useEffect, useState } from 'react';
import { EvaluationContext, FlagResult } from '@flagforge/sdk-js';
import { useFlagForge } from '../provider';

export interface UseFlagResult {
  enabled: boolean;
  value: string | undefined;
  loading: boolean;
  error: Error | null;
}

export function useFlag(key: string, context?: EvaluationContext): UseFlagResult {
  const { client, flags: globalFlags } = useFlagForge();
  const [result, setResult] = useState<UseFlagResult>({
    enabled: false,
    value: undefined,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      try {
        setResult((r) => ({ ...r, loading: true, error: null }));
        const res: FlagResult = await client.evaluate(key, context);
        if (!cancelled) {
          setResult({ enabled: res.enabled, value: res.variant, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setResult((r) => ({ ...r, loading: false, error: err as Error }));
        }
      }
    };

    evaluate();

    // Polling fallback every 30s if SSE didn't push anything
    const interval = setInterval(evaluate, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, key, JSON.stringify(context)]);

  // If global flags map was invalidated by SSE, re-evaluate immediately
  useEffect(() => {
    if (!globalFlags.has(key)) {
      const evaluate = async () => {
        try {
          const res: FlagResult = await client.evaluate(key, context);
          setResult({ enabled: res.enabled, value: res.variant, loading: false, error: null });
        } catch (err) {
          setResult((r) => ({ ...r, loading: false, error: err as Error }));
        }
      };
      evaluate();
    }
  }, [globalFlags, client, key, JSON.stringify(context)]);

  return result;
}
