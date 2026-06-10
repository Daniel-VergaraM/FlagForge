import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class EvaluateController {
  @Post('evaluate')
  @Throttle({ default: { limit: 1000, ttl: 60000 } })
  evaluate(@Body() body: any) {
    return { enabled: true };
  }
}
