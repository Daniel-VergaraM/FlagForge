import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { FlagsModule } from './flags/flags.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { MetricsModule } from './metrics/metrics.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { MockAuthMiddleware } from './auth/middleware/mock-auth.middleware';
import { EvaluateController } from './evaluate/evaluate.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AuthModule,
    AuditModule,
    MetricsModule,
    PrismaModule,
    FlagsModule,
    WebhooksModule,
    ApiKeysModule,
    HealthModule,
  ],
  controllers: [EvaluateController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MetricsMiddleware)
      .forRoutes('*');
    consumer
      .apply(MockAuthMiddleware)
      .forRoutes('*');
  }
}
