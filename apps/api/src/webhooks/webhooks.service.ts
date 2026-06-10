import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { createHmac } from 'crypto';

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        projectId: dto.projectId,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        active: dto.active ?? true,
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    return webhook;
  }

  async update(id: string, dto: UpdateWebhookDto) {
    await this.findOne(id);
    return this.prisma.webhook.update({
      where: { id },
      data: {
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        active: dto.active,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.webhook.delete({ where: { id } });
  }

  async trigger(projectId: string, event: string, payload: unknown) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        projectId,
        active: true,
        events: { has: event },
      },
    });

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      payload,
    });

    await Promise.allSettled(
      webhooks.map((webhook) => this.sendWebhook(webhook.url, body, webhook.secret)),
    );
  }

  private async sendWebhook(url: string, body: string, secret?: string | null) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers,
        body,
      });
    } catch (err) {
      // Fail silently - don't break the request if webhook fails
      console.error(`Webhook delivery failed for ${url}:`, err);
    }
  }
}
