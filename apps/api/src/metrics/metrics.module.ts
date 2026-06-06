import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsMiddleware } from './metrics.middleware';
import { PrismaMetricsInterceptor } from './prisma-metrics.interceptor';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeCounterProvider({
      name: 'prisma_queries_total',
      help: 'Total number of Prisma queries',
      labelNames: ['operation'],
    }),
    makeHistogramProvider({
      name: 'prisma_query_duration_seconds',
      help: 'Prisma query duration in seconds',
      labelNames: ['operation'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
    }),
    MetricsService,
    MetricsMiddleware,
    PrismaMetricsInterceptor,
  ],
  exports: [MetricsService, MetricsMiddleware, PrismaMetricsInterceptor, PrometheusModule],
})
export class MetricsModule {}
