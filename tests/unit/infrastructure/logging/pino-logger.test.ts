import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createPinoLogger } from '@/infrastructure/logging/pino-logger';

describe('PinoLogger', () => {
  it('writes structured JSON while redacting configured sensitive fields', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createPinoLogger({ destination });

    logger.info('request.received', {
      requestId: '01a043f4-22c5-7141-8a03-a9d9bda3544a',
      password: 'do-not-log',
      authorization: 'Bearer do-not-log',
    });

    const entry = JSON.parse(output) as Record<string, unknown>;
    expect(entry.event).toBe('request.received');
    expect(entry.requestId).toBe('01a043f4-22c5-7141-8a03-a9d9bda3544a');
    expect(entry.password).toBe('[Redacted]');
    expect(entry.authorization).toBe('[Redacted]');
  });

  it('supports every level, error serialization, and child context', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createPinoLogger({ level: 'debug', destination });

    logger.debug('debug.event');
    logger.warn('warn.event');
    logger.error('error.event', new Error('failure'));
    logger.child({ component: 'health' }).info('child.event');

    const entries = output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.map((entry) => entry.event)).toEqual([
      'debug.event',
      'warn.event',
      'error.event',
      'child.event',
    ]);
    expect(entries[2]?.err).toEqual(expect.objectContaining({ message: 'failure' }));
    expect(entries[3]?.component).toBe('health');
  });
});
