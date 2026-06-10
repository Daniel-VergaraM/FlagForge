import { Module } from '@nestjs/common';
import { FlagsService } from './flags.service';
import { FlagsController } from './flags.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuditModule } from '../audit/audit.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [PrismaModule, MessagingModule, AuditModule, WebhooksModule],
  controllers: [FlagsController],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule {}
