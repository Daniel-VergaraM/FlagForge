import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { startTracing } from './tracing';
import { JsonLogger } from './logger/json-logger.service';

// Start OpenTelemetry tracing before bootstrapping
if (process.env.OTEL_ENABLED !== 'false') {
  startTracing();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(helmet());

  // Reflects a wildcard origin by default in Nest, which is unsafe once the
  // API sits behind a real domain. CORS_ORIGIN is a comma-separated allowlist
  // (e.g. the dashboard's own origin); unset falls back to no cross-origin
  // access rather than "allow everything".
  const corsOrigins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('FlagForge API')
    .setDescription('Feature Flags Management API')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Let in-flight requests (and Prisma/Redis/NATS connections via their
  // onModuleDestroy hooks) drain before the process exits on SIGTERM/SIGINT,
  // so a rolling Kubernetes deploy doesn't 502 requests mid-flight.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3001);
  logger.log(`FlagForge API running on ${await app.getUrl()}`);
}
bootstrap();
