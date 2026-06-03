import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NatsConnection, connect, JSONCodec } from 'nats';

const jc = JSONCodec();

@Injectable()
export class MessagingService implements OnModuleDestroy {
  private nc: NatsConnection | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const servers = this.config.get<string>('NATS_URL') || 'nats://localhost:4222';
    try {
      this.nc = await connect({ servers: servers.split(','), timeout: 2000 });
    } catch {
      this.nc = null;
    }
  }

  async publish(subject: string, payload: unknown): Promise<void> {
    if (!this.nc) return;
    this.nc.publish(subject, jc.encode(payload));
  }

  async onModuleDestroy() {
    await this.nc?.drain();
  }
}
