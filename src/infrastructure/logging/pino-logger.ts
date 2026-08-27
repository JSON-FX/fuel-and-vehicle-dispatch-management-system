import type { Writable } from 'node:stream';

import pino, { type LevelWithSilent } from 'pino';

import type { LogContext, Logger } from '@/application/shared/ports/logger';

const redactedPaths = [
  'password',
  'authorization',
  'cookie',
  'token',
  'databaseUrl',
  'DATABASE_PASSWORD',
  'MIGRATION_DATABASE_PASSWORD',
  'MYSQL_ADMIN_PASSWORD',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
] as const;

class PinoLogger implements Logger {
  constructor(private readonly logger: pino.Logger) {}

  debug(event: string, context: LogContext = {}): void {
    this.logger.debug({ ...context, event });
  }

  info(event: string, context: LogContext = {}): void {
    this.logger.info({ ...context, event });
  }

  warn(event: string, context: LogContext = {}): void {
    this.logger.warn({ ...context, event });
  }

  error(event: string, error: unknown, context: LogContext = {}): void {
    this.logger.error({ ...context, err: error, event });
  }

  child(context: LogContext): Logger {
    return new PinoLogger(this.logger.child(context));
  }
}

export function createPinoLogger({
  level = 'info',
  destination,
}: {
  level?: LevelWithSilent;
  destination?: Writable;
} = {}): Logger {
  return new PinoLogger(
    pino(
      {
        level,
        redact: { paths: [...redactedPaths], censor: '[Redacted]' },
      },
      destination,
    ),
  );
}
