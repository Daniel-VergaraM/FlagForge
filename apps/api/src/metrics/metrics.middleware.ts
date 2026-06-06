import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = process.hrtime();
    const path = req.route?.path || req.path;
    const method = req.method;

    res.on('finish', () => {
      const diff = process.hrtime(start);
      const duration = diff[0] + diff[1] / 1e9;
      const status = res.statusCode.toString();

      this.metrics.httpRequestDuration.observe(
        { method, path, status },
        duration,
      );

      this.metrics.httpRequestTotal.inc({
        method,
        path,
        status,
      });
    });

    next();
  }
}
