import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: {
    apiKey: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      apiKey: {
        create: jest.fn((args) => ({ id: 'k1', revokedAt: null, ...args.data })),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
      },
    };
    service = new ApiKeysService(prisma as unknown as PrismaService);
  });

  it('generates keys prefixed with ff_ so they are recognizable in logs/UIs', async () => {
    const key = await service.create({ environmentId: 'env-1', name: 'CI key' });
    expect(key.key).toMatch(/^ff_/);
  });

  it('generates a sufficiently long, non-guessable key', async () => {
    const key = await service.create({ environmentId: 'env-1' });
    // 24 random bytes, base64url-encoded -> 32 chars, plus the "ff_" prefix.
    expect(key.key.length).toBeGreaterThanOrEqual(32);
  });

  it('generates a different key on every call', async () => {
    const a = await service.create({ environmentId: 'env-1' });
    const b = await service.create({ environmentId: 'env-1' });
    expect(a.key).not.toBe(b.key);
  });

  it('findAll only returns non-revoked keys by default', async () => {
    await service.findAll();
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revokedAt: null } }),
    );
  });

  it('findAll scopes to an environment when one is given', async () => {
    await service.findAll('env-1');
    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revokedAt: null, environmentId: 'env-1' } }),
    );
  });

  it('revoke sets revokedAt rather than deleting the row (audit trail)', async () => {
    const revoked = await service.revoke('k1');
    expect(prisma.apiKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'k1' }, data: { revokedAt: expect.any(Date) } }),
    );
    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });
});
