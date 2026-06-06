import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Histogram, Counter, register } from 'prom-client';

const prismaQueryDuration = new Histogram({
  name: 'prisma_query_duration_seconds_manual',
  help: 'Duration of Prisma queries in seconds',
  labelNames: ['model', 'action'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
});

const prismaQueryTotal = new Counter({
  name: 'prisma_queries_total_manual',
  help: 'Total number of Prisma queries',
  labelNames: ['model', 'action'],
  registers: [register],
});

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();

    this.$use(async (params, next) => {
      const start = Date.now();
      try {
        const result = await next(params);
        return result;
      } finally {
        const duration = (Date.now() - start) / 1000;
        prismaQueryDuration.observe(
          { model: params.model || 'raw', action: params.action },
          duration,
        );
        prismaQueryTotal.inc({
          model: params.model || 'raw',
          action: params.action,
        });
      }
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
