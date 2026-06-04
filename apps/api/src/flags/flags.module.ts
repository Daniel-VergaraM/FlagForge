import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { FlagsService } from './flags.service';
import { FlagsController } from './flags.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuditModule } from '../audit/audit.module';
import { MockAuthMiddleware } from '../auth/middleware/mock-auth.middleware';

@Module({
  imports: [PrismaModule, MessagingModule, AuditModule],
  controllers: [FlagsController],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MockAuthMiddleware)
      .forRoutes(FlagsController);
  }
}
