import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaMetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const handlerName = context.getHandler().name;
    const className = context.getClass().name;

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - start) / 1000;
        this.metrics.prismaQueryDuration.observe(
          { operation: `${className}.${handlerName}` },
          duration,
        );
        this.metrics.prismaQueriesTotal.inc({
          operation: `${className}.${handlerName}`,
        });
      }),
    );
  }
}
