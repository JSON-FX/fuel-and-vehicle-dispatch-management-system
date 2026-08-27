import { afterEach, describe, expect, it } from 'vitest';

import type { DatabaseEnvironment } from '@/infrastructure/config/environment';
import {
  createDatabaseClient,
  createMysqlPoolOptions,
  destroyDatabaseClients,
  getMigrationDatabase,
  getRuntimeDatabase,
} from '@/infrastructure/database/client';
import { createMigrator } from '@/infrastructure/database/migrator';

const databaseEnvironment: DatabaseEnvironment = {
  host: 'mysql',
  port: 3306,
  name: 'fvdms',
  user: 'fvdms_app',
  password: 'local-app-password',
  poolMin: 1,
  poolMax: 12,
  connectTimeoutMs: 5_000,
  queryTimeoutMs: 2_000,
};

const processEnvironment = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '1',
  DATABASE_NAME: 'fvdms_test',
  DATABASE_USER: 'fvdms_app',
  DATABASE_PASSWORD: 'application-password',
  DATABASE_POOL_MIN: '0',
  DATABASE_POOL_MAX: '2',
  DATABASE_CONNECT_TIMEOUT_MS: '50',
  DATABASE_QUERY_TIMEOUT_MS: '50',
  MIGRATION_DATABASE_USER: 'fvdms_migrator',
  MIGRATION_DATABASE_PASSWORD: 'migration-password',
};

afterEach(async () => {
  await destroyDatabaseClients();
});

describe('MySQL pool options', () => {
  it('preserves BIGINT and DECIMAL values as strings', () => {
    const options = createMysqlPoolOptions(databaseEnvironment);

    expect(options.supportBigNumbers).toBe(true);
    expect(options.bigNumberStrings).toBe(true);
    expect(options.decimalNumbers).toBe(false);
  });

  it('uses UTC and the configured bounded pool size', () => {
    const options = createMysqlPoolOptions(databaseEnvironment);

    expect(options.timezone).toBe('Z');
    expect(options.connectionLimit).toBe(12);
    expect(options.connectTimeout).toBe(5_000);
    expect(options.waitForConnections).toBe(true);
    expect(options.queueLimit).toBe(0);
  });

  it('creates lazy singleton runtime and migration clients', async () => {
    const runtime = getRuntimeDatabase(processEnvironment);
    const migration = getMigrationDatabase(processEnvironment);

    expect(getRuntimeDatabase(processEnvironment)).toBe(runtime);
    expect(getMigrationDatabase(processEnvironment)).toBe(migration);
    expect(migration).not.toBe(runtime);
    expect(createMigrator(migration)).toBeDefined();
  });

  it('creates and disposes an independent client without connecting', async () => {
    const database = createDatabaseClient(databaseEnvironment);
    await expect(database.destroy()).resolves.toBeUndefined();
  });
});
