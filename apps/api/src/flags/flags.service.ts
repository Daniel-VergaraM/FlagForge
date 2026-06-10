import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { MessagingService } from '../messaging/messaging.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FlagsService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private messaging: MessagingService,
    private webhooks: WebhooksService,
  ) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') || 'redis://localhost:6379');
  }

  async create(dto: CreateFlagDto) {
    const flag = await this.prisma.flag.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        enabled: dto.enabled ?? false,
        environmentId: dto.environmentId,
        tags: dto.tags ?? [],
        rules: (dto.rules ?? null) as any,
        rolloutPercentage: dto.rolloutPercentage ?? 100,
        variants: {
          create: (dto.variants ?? []).map(v => ({
            value: v.value as any,
            weight: v.weight,
          })),
        },
      },
      include: { environment: true, variants: true },
    });
    await this.writeFlagToCache(flag as any);
    await this.webhooks.trigger(flag.environment.projectId, 'flag.created', flag);
    return flag;
  }

  async findAll(envId?: string, query?: string) {
    const where: any = envId ? { environmentId: envId } : {};
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { key: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ];
    }
    return this.prisma.flag.findMany({
      where,
      include: { variants: true },
    });
  }

  async findOne(id: string) {
    const flag = await this.prisma.flag.findUnique({
      where: { id },
      include: { variants: true, environment: true },
    });
    if (!flag) throw new NotFoundException('Flag not found');
    return flag;
  }

  async update(id: string, dto: UpdateFlagDto) {
    await this.findOne(id);

    const data: any = {
      name: dto.name,
      description: dto.description,
      type: dto.type,
      enabled: dto.enabled,
      tags: dto.tags,
      rules: dto.rules ? (dto.rules as any) : undefined,
      rolloutPercentage: dto.rolloutPercentage,
    };

    // If variants are provided, replace them
    if (dto.variants !== undefined) {
      await this.prisma.flagVariant.deleteMany({ where: { flagId: id } });
      data.variants = {
        create: dto.variants.map(v => ({
          value: v.value as any,
          weight: v.weight,
        })),
      };
    }

    const flag = await this.prisma.flag.update({
      where: { id },
      data,
      include: { environment: true, variants: true },
    });
    await this.writeFlagToCache(flag as any);
    await this.webhooks.trigger(flag.environment.projectId, 'flag.updated', flag);
    return flag;
  }

  async remove(id: string) {
    const flag = await this.findOne(id);
    await this.prisma.flag.delete({ where: { id } });
    await this.invalidateCache(flag.environment.sdkKey, flag.key);
    await this.webhooks.trigger(flag.environment.projectId, 'flag.deleted', flag);
    return flag;
  }

  private async writeFlagToCache(flag: any) {
    const cacheKey = `flag:${flag.environment.sdkKey}:${flag.key}`;
    const payload = {
      key: flag.key,
      enabled: flag.enabled,
      type: flag.type,
      rules: flag.rules ?? [],
      tags: flag.tags ?? [],
      rolloutPercentage: flag.rolloutPercentage ?? 100,
      variants: (flag.variants || []).map((v: any) => ({ value: v.value, weight: v.weight })),
    };
    await this.redis.setex(cacheKey, 300, JSON.stringify(payload));
    await this.messaging.publish('flag.changed', { sdkKey: flag.environment.sdkKey, flagKey: flag.key });
  }

  private async invalidateCache(sdkKey: string, flagKey: string) {
    const cacheKey = `flag:${sdkKey}:${flagKey}`;
    await this.redis.del(cacheKey);
    await this.messaging.publish('flag.changed', { sdkKey, flagKey });
  }
}
