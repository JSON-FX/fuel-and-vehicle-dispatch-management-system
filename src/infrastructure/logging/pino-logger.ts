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

const sensitiveKeys = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'passwordhash',
  'temporarypassword',
  'authorization',
  'cookie',
  'cookies',
  'token',
  'tokenhash',
  'bearertoken',
  'sessiontoken',
  'challengetoken',
  'csrftoken',
  'csrftokenhash',
  'totpcode',
  'otpcode',
  'manualsecret',
  'secret',
  'encryptedsecret',
  'ciphertext',
  'authenticationtag',
  'iv',
  'enrollmenturi',
  'qrsvg',
  'databaseurl',
  'databasepassword',
  'migrationdatabasepassword',
  'mysqladminpassword',
]);

function normalizeKey(key: string): string {
  return key.replaceAll(/[_-]/g, '').toLowerCase();
}

function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof Uint8Array) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (value instanceof Error) {
    const serialized: Record<string, unknown> = {
      type: value.name,
      message: value.message,
      stack: value.stack,
    };
    for (const [key, property] of Object.entries(value)) {
      serialized[key] = sensitiveKeys.has(normalizeKey(key))
        ? '[Redacted]'
        : sanitize(property, seen);
    }
    if (value.cause !== undefined) serialized.cause = sanitize(value.cause, seen);
    return serialized;
  }

  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, property]) => [
      key,
      sensitiveKeys.has(normalizeKey(key)) ? '[Redacted]' : sanitize(property, seen),
    ]),
  );
}

function sanitizeContext(context: LogContext): LogContext {
  return sanitize(context) as LogContext;
}

class PinoLogger implements Logger {
  constructor(private readonly logger: pino.Logger) {}

  debug(event: string, context: LogContext = {}): void {
    this.logger.debug({ ...sanitizeContext(context), event });
  }

  info(event: string, context: LogContext = {}): void {
    this.logger.info({ ...sanitizeContext(context), event });
  }

  warn(event: string, context: LogContext = {}): void {
    this.logger.warn({ ...sanitizeContext(context), event });
  }

  error(event: string, error: unknown, context: LogContext = {}): void {
    this.logger.error({ ...sanitizeContext(context), err: sanitize(error), event });
  }

  child(context: LogContext): Logger {
    return new PinoLogger(this.logger.child(sanitizeContext(context)));
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
