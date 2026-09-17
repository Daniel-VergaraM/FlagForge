import { createHmac } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: {
    webhook: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      webhook: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    service = new WebhooksService(prisma as unknown as PrismaService);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('findOne throws NotFoundException for a missing webhook', async () => {
    prisma.webhook.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('remove deletes only after confirming the webhook exists', async () => {
    prisma.webhook.findUnique.mockResolvedValue({ id: 'w1' });
    prisma.webhook.delete.mockResolvedValue({ id: 'w1' });

    await service.remove('w1');

    expect(prisma.webhook.findUnique).toHaveBeenCalledWith({ where: { id: 'w1' } });
    expect(prisma.webhook.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
  });

  it('trigger only delivers to active webhooks subscribed to the event', async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'w1', url: 'https://example.com/hook', secret: null, active: true, events: ['flag.changed'] },
    ]);

    await service.trigger('project-1', 'flag.changed', { key: 'my-flag' });

    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-1', active: true, events: { has: 'flag.changed' } },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(init.method).toBe('POST');
  });

  it('signs the payload with HMAC-SHA256 when the webhook has a secret', async () => {
    const secret = 'top-secret';
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'w1', url: 'https://example.com/hook', secret, active: true, events: ['flag.changed'] },
    ]);

    await service.trigger('project-1', 'flag.changed', { key: 'my-flag' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const expectedSignature = createHmac('sha256', secret).update(init.body).digest('hex');
    expect(init.headers['X-Webhook-Signature']).toBe(`sha256=${expectedSignature}`);
  });

  it('omits the signature header when the webhook has no secret', async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'w1', url: 'https://example.com/hook', secret: null, active: true, events: ['flag.changed'] },
    ]);

    await service.trigger('project-1', 'flag.changed', {});

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers['X-Webhook-Signature']).toBeUndefined();
  });

  it('does not throw when webhook delivery fails (best-effort fan-out)', async () => {
    prisma.webhook.findMany.mockResolvedValue([
      { id: 'w1', url: 'https://unreachable.example.com', secret: null, active: true, events: ['flag.changed'] },
    ]);
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.trigger('project-1', 'flag.changed', {})).resolves.toBeUndefined();
  });
});
