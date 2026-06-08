import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  FlagForgeClient,
  FlagForgeClientConfig,
  EvaluationContext,
  FlagResult,
} from '@flagforge/sdk-js';

export interface FlagState {
  enabled: boolean;
  variant?: string;
  metadata?: Record<string, unknown>;
}

export interface FlagForgeContextValue {
  client: FlagForgeClient;
  flags: Map<string, FlagState>;
  ready: boolean;
  error: Error | null;
}

const FlagForgeContext = createContext<FlagForgeContextValue | null>(null);

export function useFlagForge() {
  const ctx = useContext(FlagForgeContext);
  if (!ctx) throw new Error('useFlagForge must be used within <FlagForgeProvider>');
  return ctx;
}

interface ProviderProps {
  config: FlagForgeClientConfig;
  children: React.ReactNode;
}

export function FlagForgeProvider({ config, children }: ProviderProps) {
  const clientRef = useRef(new FlagForgeClient(config));
  const [flags, setFlags] = useState<Map<string, FlagState>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const client = clientRef.current;

    const init = async () => {
      try {
        // Pre-warm with defaults
        setReady(true);
      } catch (err) {
        setError(err as Error);
      }
    };

    init();

    // SSE integration: connect to evaluator stream
    let sse: EventSource | null = null;
    const baseUrl = config.evaluatorUrl || 'https://api.flagforge.io';
    const streamUrl = `${baseUrl}/evaluate/stream?sdkKey=${encodeURIComponent(config.sdkKey)}`;

    try {
      sse = new EventSource(streamUrl);
      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'flag.changed') {
            const { flagKey } = payload;
            // Invalidate the React-side flag state so hooks re-fetch
            setFlags((prev) => {
              const next = new Map(prev);
              if (next.has(flagKey)) {
                next.delete(flagKey);
              }
              return next;
            });
          }
        } catch {
          // ignore malformed sse
        }
      };
      sse.onerror = () => {
        // Will auto-reconnect; no-op
      };
    } catch {
      // SSE not supported or URL unreachable; keep polling
    }

    return () => {
      sse?.close();
    };
  }, [config.sdkKey, config.evaluatorUrl]);

  const value: FlagForgeContextValue = {
    client: clientRef.current,
    flags,
    ready,
    error,
  };

  return <FlagForgeContext.Provider value={value}>{children}</FlagForgeContext.Provider>;
}
