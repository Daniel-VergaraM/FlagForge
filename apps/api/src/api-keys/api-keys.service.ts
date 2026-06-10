import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  private generateKey(): string {
    const suffix = randomBytes(24).toString('base64url');
    return `ff_${suffix}`;
  }

  async create(dto: CreateApiKeyDto) {
    const key = this.generateKey();
    return this.prisma.apiKey.create({
      data: {
        key,
        name: dto.name,
        environmentId: dto.environmentId,
      },
      include: { environment: true },
    });
  }

  async findAll(environmentId?: string) {
    const where: any = { revokedAt: null };
    if (environmentId) {
      where.environmentId = environmentId;
    }
    return this.prisma.apiKey.findMany({
      where,
      include: { environment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.apiKey.findUnique({
      where: { id },
      include: { environment: true },
    });
  }

  async findByKey(key: string) {
    return this.prisma.apiKey.findUnique({
      where: { key },
      include: { environment: true },
    });
  }

  async revoke(id: string) {
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async recordUsage(id: string) {
    return this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}
