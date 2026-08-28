import { describe, expect, it } from 'vitest';

import {
  parseBootstrapEnvironment,
  parseBuildEnvironment,
  parseMigrationEnvironment,
  parseRuntimeEnvironment,
} from '@/infrastructure/config/environment';

const runtimeEnvironment = {
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',
  DATABASE_HOST: 'mysql',
  DATABASE_PORT: '3306',
  DATABASE_NAME: 'fvdms',
  DATABASE_USER: 'fvdms_app',
  DATABASE_PASSWORD: 'local-app-password',
  DATABASE_POOL_MIN: '1',
  DATABASE_POOL_MAX: '10',
  DATABASE_CONNECT_TIMEOUT_MS: '5000',
  DATABASE_QUERY_TIMEOUT_MS: '2000',
  AUTH_ALLOWED_ORIGIN: 'https://fvdms.lan',
  AUTH_STANDARD_IDLE_TIMEOUT_SECONDS: '1800',
  AUTH_PRIVILEGED_IDLE_TIMEOUT_SECONDS: '900',
  AUTH_ABSOLUTE_TIMEOUT_SECONDS: '28800',
  AUTH_PRIVILEGED_SESSION_LIMIT: '1',
  AUTH_RATE_LIMIT_MAX_FAILURES: '5',
  AUTH_RATE_LIMIT_WINDOW_SECONDS: '900',
  AUTH_RATE_LIMIT_LOCK_SECONDS: '900',
  AUTH_CHALLENGE_TTL_SECONDS: '300',
  AUTH_ACTIVITY_WRITE_INTERVAL_SECONDS: '300',
  AUTH_PASSWORD_MIN_LENGTH: '12',
  AUTH_PASSWORD_MAX_LENGTH: '128',
  AUTH_TOTP_ACTIVE_KEY_VERSION: '1',
  AUTH_TOTP_ENCRYPTION_KEYS: '{"1":"MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="}',
  AUTH_RATE_LIMIT_HMAC_KEY: 'YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODk=',
};

describe('environment parsing', () => {
  it('parses the documented runtime environment into typed values', () => {
    expect(parseRuntimeEnvironment(runtimeEnvironment)).toEqual({
      nodeEnv: 'development',
      logLevel: 'info',
      database: {
        host: 'mysql',
        port: 3306,
        name: 'fvdms',
        user: 'fvdms_app',
        password: 'local-app-password',
        poolMin: 1,
        poolMax: 10,
        connectTimeoutMs: 5000,
        queryTimeoutMs: 2000,
      },
      auth: {
        allowedOrigin: 'https://fvdms.lan',
        standardIdleTimeoutSeconds: 1800,
        privilegedIdleTimeoutSeconds: 900,
        absoluteTimeoutSeconds: 28800,
        privilegedSessionLimit: 1,
        rateLimitMaxFailures: 5,
        rateLimitWindowSeconds: 900,
        rateLimitLockSeconds: 900,
        challengeTtlSeconds: 300,
        activityWriteIntervalSeconds: 300,
        passwordMinLength: 12,
        passwordMaxLength: 128,
        totpActiveKeyVersion: 1,
        totpEncryptionKeys: {
          1: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
        },
        rateLimitHmacKey: 'YWJjZGVmMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODk=',
      },
    });
  });

  it('rejects authentication keys that are not exactly 32 bytes', () => {
    expect(() =>
      parseRuntimeEnvironment({
        ...runtimeEnvironment,
        AUTH_RATE_LIMIT_HMAC_KEY: Buffer.from('too-short').toString('base64'),
      }),
    ).toThrow('AUTH_RATE_LIMIT_HMAC_KEY must decode to exactly 32 bytes.');
  });

  it('rejects a TOTP key ring without the active key version', () => {
    expect(() =>
      parseRuntimeEnvironment({
        ...runtimeEnvironment,
        AUTH_TOTP_ACTIVE_KEY_VERSION: '2',
      }),
    ).toThrow('AUTH_TOTP_ENCRYPTION_KEYS must contain active key version 2.');
  });

  it('rejects a missing runtime database password', () => {
    const withoutPassword: Record<string, string> = { ...runtimeEnvironment };
    Reflect.deleteProperty(withoutPassword, 'DATABASE_PASSWORD');

    expect(() => parseRuntimeEnvironment(withoutPassword)).toThrow();
  });

  it('rejects malformed numeric configuration', () => {
    expect(() =>
      parseRuntimeEnvironment({ ...runtimeEnvironment, DATABASE_PORT: 'not-a-port' }),
    ).toThrow();
  });

  it('rejects a secret exposed through a NEXT_PUBLIC variable', () => {
    expect(() =>
      parseRuntimeEnvironment({
        ...runtimeEnvironment,
        NEXT_PUBLIC_DATABASE_PASSWORD: 'leaked',
      }),
    ).toThrow();
  });

  it('rejects TOTP key material exposed through a NEXT_PUBLIC variable', () => {
    expect(() =>
      parseRuntimeEnvironment({
        ...runtimeEnvironment,
        NEXT_PUBLIC_AUTH_TOTP_ENCRYPTION_KEYS: runtimeEnvironment.AUTH_TOTP_ENCRYPTION_KEYS,
      }),
    ).toThrow('NEXT_PUBLIC_AUTH_TOTP_ENCRYPTION_KEYS must not expose server-only configuration.');
  });

  it('parses migration credentials separately from runtime credentials', () => {
    expect(
      parseMigrationEnvironment({
        ...runtimeEnvironment,
        MIGRATION_DATABASE_USER: 'fvdms_migrator',
        MIGRATION_DATABASE_PASSWORD: 'local-migrator-password',
      }).database.user,
    ).toBe('fvdms_migrator');
  });

  it('allows the local shared MySQL administrator to use an empty password', () => {
    expect(
      parseBootstrapEnvironment({
        MYSQL_ADMIN_HOST: 'mysql',
        MYSQL_ADMIN_PORT: '3306',
        MYSQL_ADMIN_USER: 'root',
        MYSQL_ADMIN_PASSWORD: '',
        DATABASE_NAME: 'fvdms',
        DATABASE_USER: 'fvdms_app',
        DATABASE_PASSWORD: 'local-app-password',
        MIGRATION_DATABASE_USER: 'fvdms_migrator',
        MIGRATION_DATABASE_PASSWORD: 'local-migrator-password',
      }).administrator.password,
    ).toBe('');
  });

  it('allows a production build without runtime database variables', () => {
    expect(parseBuildEnvironment({ NODE_ENV: 'production' })).toEqual({
      nodeEnv: 'production',
      logLevel: 'info',
    });
  });
});
