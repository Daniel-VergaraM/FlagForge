import {
  FlagForgeClientConfig,
  EvaluationContext,
  FlagResult,
} from './types';
import { LruCache } from './cache/lru-cache';
import { EvaluatorClient } from './evaluator-client';

const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_CACHE_MAX_SIZE = 1_000;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_POLLING_INTERVAL_MS = 60_000;

/**
 * Main FlagForge SDK client.
 *
 * Provides flag evaluation with local LRU caching, automatic fallback
 * to default values, and optional background polling.
 */
export class FlagForgeClient {
  private readonly evaluator: EvaluatorClient;
  private readonly cache: LruCache;
  private readonly defaults: Record<string, boolean>;
  private readonly defaultVariants: Record<string, string>;
  private readonly pollingIntervalMs: number;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private isClosed = false;

  constructor(config: FlagForgeClientConfig) {
    this.evaluator = new EvaluatorClient(
      config.evaluatorUrl,
      config.sdkKey,
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    this.cache = new LruCache(
      config.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE,
      config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS,
    );

    this.defaults = config.defaults ?? {};
    this.defaultVariants = config.defaultVariants ?? {};
    this.pollingIntervalMs =
      config.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS;
  }

  /**
   * Check if a feature flag is enabled for the given context.
   * Returns the default value if the evaluator is unreachable.
   */
  async isEnabled(flagKey: string, context?: EvaluationContext): Promise<boolean> {
    const result = await this.evaluate(flagKey, context);
    return result.enabled;
  }

  /**
   * Get the assigned variant for a multivariant flag.
   * Returns the default variant if the evaluator is unreachable
   * or no variant is assigned.
   */
  async getVariant(
    flagKey: string,
    context?: EvaluationContext,
  ): Promise<string | undefined> {
    const result = await this.evaluate(flagKey, context);
    return result.variant ?? this.defaultVariants[flagKey];
  }

  /**
   * Evaluate a flag, returning the full result.
   */
  async evaluate(flagKey: string, context?: EvaluationContext): Promise<FlagResult> {
    if (this.isClosed) {
      throw new Error('FlagForgeClient has been closed');
    }

    const cacheKey = this.buildCacheKey(flagKey, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.result;
    }

    try {
      const result = await this.evaluator.evaluate(flagKey, context);
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const defaultValue = this.defaults[flagKey] ?? false;
      return {
        enabled: defaultValue,
        variant: this.defaultVariants[flagKey],
      };
    }
  }

  /**
   * Start background polling to keep the cache warm.
   * Pass an array of flag keys to poll.
   */
  startPolling(flagKeys: string[], context?: EvaluationContext): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    this.pollingTimer = setInterval(async () => {
      for (const key of flagKeys) {
        try {
          const result = await this.evaluator.evaluate(key, context);
          this.cache.set(this.buildCacheKey(key, context), result);
        } catch {
          // Silently ignore polling errors
        }
      }
    }, this.pollingIntervalMs);
  }

  /**
   * Stop background polling.
   */
  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Close the client, stopping polling and clearing the cache.
   */
  close(): void {
    this.isClosed = true;
    this.stopPolling();
    this.cache.clear();
  }

  private buildCacheKey(flagKey: string, context?: EvaluationContext): string {
    if (!context || Object.keys(context).length === 0) {
      return flagKey;
    }
    const ctxHash = JSON.stringify(context);
    return `${flagKey}:${ctxHash}`;
  }
}

/**
 * Factory function to create a FlagForge client.
 */
export function createClient(config: FlagForgeClientConfig): FlagForgeClient {
  return new FlagForgeClient(config);
}
