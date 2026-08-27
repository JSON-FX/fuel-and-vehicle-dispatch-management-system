import { Kysely, MysqlDialect } from 'kysely';
import { createPool, type PoolOptions } from 'mysql2';

import {
  type DatabaseEnvironment,
  parseMigrationEnvironment,
  parseRuntimeEnvironment,
} from '@/infrastructure/config/environment';
import type { Database } from '@/infrastructure/database/types';

let runtimeDatabase: Kysely<Database> | undefined;
let migrationDatabase: Kysely<Database> | undefined;

export function createMysqlPoolOptions(environment: DatabaseEnvironment): PoolOptions {
  return {
    host: environment.host,
    port: environment.port,
    database: environment.name,
    user: environment.user,
    password: environment.password,
    connectionLimit: environment.poolMax,
    connectTimeout: environment.connectTimeoutMs,
    waitForConnections: true,
    queueLimit: 0,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    timezone: 'Z',
    enableKeepAlive: true,
  };
}

export function createDatabaseClient(environment: DatabaseEnvironment): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new MysqlDialect({
      pool: createPool(createMysqlPoolOptions(environment)),
    }),
  });
}

export function getRuntimeDatabase(
  environment: Record<string, string | undefined> = process.env,
): Kysely<Database> {
  runtimeDatabase ??= createDatabaseClient(parseRuntimeEnvironment(environment).database);
  return runtimeDatabase;
}

export function getMigrationDatabase(
  environment: Record<string, string | undefined> = process.env,
): Kysely<Database> {
  migrationDatabase ??= createDatabaseClient(parseMigrationEnvironment(environment).database);
  return migrationDatabase;
}

export async function destroyDatabaseClients(): Promise<void> {
  const clients = [runtimeDatabase, migrationDatabase].filter(
    (database): database is Kysely<Database> => database !== undefined,
  );

  runtimeDatabase = undefined;
  migrationDatabase = undefined;
  await Promise.all(clients.map(async (database) => database.destroy()));
}
