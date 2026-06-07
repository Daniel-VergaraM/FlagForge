/**
 * Context passed to flag evaluations. Allows segment-based targeting.
 */
export interface EvaluationContext {
  userId?: string;
  email?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Result of a flag evaluation from the Evaluator service.
 */
export interface FlagResult {
  enabled: boolean;
  variant?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the FlagForge SDK client.
 */
export interface FlagForgeClientConfig {
  /** SDK key for authentication */
  sdkKey: string;
  /** Base URL of the Evaluator service */
  evaluatorUrl: string;
  /** Default values for flags when evaluator is unreachable */
  defaults?: Record<string, boolean>;
  /** Default variants for multivariant flags */
  defaultVariants?: Record<string, string>;
  /** Cache TTL in milliseconds (default: 30000) */
  cacheTtlMs?: number;
  /** Maximum cache size (default: 1000) */
  cacheMaxSize?: number;
  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs?: number;
  /** Polling interval in milliseconds (default: 60000) */
  pollingIntervalMs?: number;
}

/**
 * Internal entry stored in the LRU cache.
 */
export interface CacheEntry {
  result: FlagResult;
  expiresAt: number;
}
