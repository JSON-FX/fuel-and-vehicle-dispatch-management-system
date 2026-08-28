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

  it('redacts nested authentication credentials and encrypted secret material', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createPinoLogger({ destination });

    logger.info('auth.request', {
      request: {
        body: {
          password: 'current-secret',
          newPassword: 'replacement-secret',
          totpCode: '123456',
        },
        cookies: {
          sessionToken: 'session-secret',
          challengeToken: 'challenge-secret',
        },
      },
      result: {
        temporaryPassword: 'one-time-secret',
        csrfToken: 'csrf-secret',
        enrollmentUri: 'otpauth://totp/secret',
        encryptedSecret: {
          ciphertext: 'ciphertext-secret',
          authenticationTag: 'tag-secret',
          iv: 'iv-secret',
        },
      },
    });

    const entry = JSON.parse(output) as Record<string, unknown>;
    expect(JSON.stringify(entry)).not.toContain('current-secret');
    expect(JSON.stringify(entry)).not.toContain('replacement-secret');
    expect(JSON.stringify(entry)).not.toContain('123456');
    expect(JSON.stringify(entry)).not.toContain('session-secret');
    expect(JSON.stringify(entry)).not.toContain('challenge-secret');
    expect(JSON.stringify(entry)).not.toContain('one-time-secret');
    expect(JSON.stringify(entry)).not.toContain('csrf-secret');
    expect(JSON.stringify(entry)).not.toContain('otpauth://');
    expect(JSON.stringify(entry)).not.toContain('ciphertext-secret');
    expect(JSON.stringify(entry)).toContain('[Redacted]');
  });

  it('redacts sensitive enumerable properties from logged errors', () => {
    let output = '';
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createPinoLogger({ destination });
    const error = Object.assign(new Error('Authentication failed.'), {
      bearerToken: 'error-token',
      details: { passwordHash: 'error-hash' },
    });

    logger.error('auth.failure', error);

    expect(output).not.toContain('error-token');
    expect(output).not.toContain('error-hash');
    expect(output).toContain('Authentication failed.');
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
