import { FlagForgeClient } from '../src/client';

describe('FlagForgeClient', () => {
  const createClient = () =>
    new FlagForgeClient({
      sdkKey: 'test-key',
      evaluatorUrl: 'http://localhost:3002',
      defaults: { 'default-off': false, 'default-on': true },
      defaultVariants: { 'mv-flag': 'control' },
      cacheTtlMs: 50,
      timeoutMs: 5000,
    });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('evaluates a flag via HTTP', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createClient();
    const enabled = await client.isEnabled('new-feature');
    expect(enabled).toBe(true);
    client.close();
  });

  it('caches repeated evaluations', async () => {
    const mockFetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ enabled: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createClient();
    await client.isEnabled('cached-flag');
    await client.isEnabled('cached-flag');
    await client.isEnabled('cached-flag');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    client.close();
  });

  it('falls back to default on evaluator error', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );

    const client = createClient();
    const enabled = await client.isEnabled('default-on');
    expect(enabled).toBe(true);
    client.close();
  });

  it('falls back to false when no default is configured', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );

    const client = createClient();
    const enabled = await client.isEnabled('unknown-flag');
    expect(enabled).toBe(false);
    client.close();
  });

  it('returns variant from evaluator', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ enabled: true, variant: 'treatment' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createClient();
    const variant = await client.getVariant('mv-flag');
    expect(variant).toBe('treatment');
    client.close();
  });

  it('falls back to default variant', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );

    const client = createClient();
    const variant = await client.getVariant('mv-flag');
    expect(variant).toBe('control');
    client.close();
  });

  it('respects different contexts for same flag', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const body = JSON.parse((init as RequestInit)?.body as string);
      const userId = body.context?.userId;
      return new Response(
        JSON.stringify({ enabled: userId === 'admin' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const client = createClient();
    const adminEnabled = await client.isEnabled('feature', { userId: 'admin' });
    const userEnabled = await client.isEnabled('feature', { userId: 'user' });

    expect(adminEnabled).toBe(true);
    expect(userEnabled).toBe(false);
    client.close();
  });

  it('throws when closed', async () => {
    const client = createClient();
    client.close();
    await expect(client.isEnabled('any')).rejects.toThrow('FlagForgeClient has been closed');
  });

  it('background polling updates cache', async () => {
    let enabled = false;
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => {
      return Promise.resolve(
        new Response(JSON.stringify({ enabled }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    const client = new FlagForgeClient({
      sdkKey: 'test-key',
      evaluatorUrl: 'http://localhost:3002',
      cacheTtlMs: 5000,
      timeoutMs: 5000,
      pollingIntervalMs: 50,
    });

    client.startPolling(['toggle-flag']);

    // Initial state
    enabled = false;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const first = await client.isEnabled('toggle-flag');
    expect(first).toBe(false);

    // Simulate flag being toggled on backend
    enabled = true;
    await new Promise((resolve) => setTimeout(resolve, 80));

    const second = await client.isEnabled('toggle-flag');
    expect(second).toBe(true);

    client.close();
  });
});
