import { EvaluationContext, FlagResult } from './types';

export interface EvaluatorResponse {
  enabled: boolean;
  variant?: string;
  metadata?: Record<string, unknown>;
}

/**
 * HTTP client that communicates with the FlagForge Evaluator service.
 */
export class EvaluatorClient {
  private readonly baseUrl: string;
  private readonly sdkKey: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, sdkKey: string, timeoutMs: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.sdkKey = sdkKey;
    this.timeoutMs = timeoutMs;
  }

  async evaluate(flagKey: string, context?: EvaluationContext): Promise<FlagResult> {
    const url = `${this.baseUrl}/evaluate`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SDK-Key': this.sdkKey,
        },
        body: JSON.stringify({ flag: flagKey, context }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Evaluator returned ${response.status}`);
      }

      const data = (await response.json()) as EvaluatorResponse;
      return {
        enabled: data.enabled,
        variant: data.variant,
        metadata: data.metadata,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Evaluator request timed out');
      }
      throw error;
    }
  }
}
