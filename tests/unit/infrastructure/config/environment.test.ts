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
    });
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
