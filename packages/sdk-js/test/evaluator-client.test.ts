import { EvaluatorClient } from '../src/evaluator-client';

describe('EvaluatorClient', () => {
  const client = new EvaluatorClient('http://localhost:3002', 'test-key', 5000);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns flag result on success', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ enabled: true, variant: 'control' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await client.evaluate('new-feature', { userId: '123' });
    expect(result.enabled).toBe(true);
    expect(result.variant).toBe('control');
  });

  it('throws on HTTP error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 500 }),
    );

    await expect(client.evaluate('any-flag')).rejects.toThrow(
      'Evaluator returned 500',
    );
  });

  it('throws on timeout', async () => {
    const slowClient = new EvaluatorClient('http://localhost:3002', 'key', 10);

    jest.spyOn(globalThis, 'fetch').mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100);
      });
    });

    // Mock AbortController to simulate timeout
    const originalAbortController = globalThis.AbortController;
    globalThis.AbortController = jest.fn().mockImplementation(() => ({
      signal: { aborted: true, addEventListener: jest.fn(), removeEventListener: jest.fn() },
      abort: jest.fn(),
    })) as unknown as typeof AbortController;

    await expect(slowClient.evaluate('any-flag')).rejects.toThrow();

    globalThis.AbortController = originalAbortController;
  });

  it('sends correct headers', async () => {
    const mockFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await client.evaluate('flag');

    const requestInit = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;
    expect(headers['X-SDK-Key']).toBe('test-key');
    expect(headers['Content-Type']).toContain('application/json');
  });
});
