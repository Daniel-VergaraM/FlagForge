import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Minimal structured (JSON-lines) logger. Container platforms (CloudWatch,
 * Loki, Stackdriver, kubectl logs | jq) expect one JSON object per line
 * rather than Nest's default colorized text - this avoids pulling in a
 * heavier dependency (pino/winston) just to get that.
 */
export class JsonLogger implements LoggerService {
  private write(level: LogLevel, message: unknown, context?: string, trace?: string) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: message instanceof Error ? message.message : message,
      ...(trace ? { trace } : {}),
      ...(message instanceof Error && message.stack ? { stack: message.stack } : {}),
    };
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  }

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }
}
