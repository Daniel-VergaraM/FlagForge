import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    public readonly httpRequestTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    public readonly httpRequestDuration: Histogram<string>,
    @InjectMetric('prisma_queries_total')
    public readonly prismaQueriesTotal: Counter<string>,
    @InjectMetric('prisma_query_duration_seconds')
    public readonly prismaQueryDuration: Histogram<string>,
  ) {}
}
