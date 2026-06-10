import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => ({
        prisma: {
          status: 'up',
          // In production, run a raw query here
        },
      }),
    ]);
  }
}
