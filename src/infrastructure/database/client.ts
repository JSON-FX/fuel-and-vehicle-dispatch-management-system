import { Kysely, MysqlDialect } from 'kysely';
import { createPool, type PoolOptions } from 'mysql2';

import {
  type DatabaseEnvironment,
  parseMigrationEnvironment,
  parseRuntimeEnvironment,
} from '@/infrastructure/config/environment';
import type { Database } from '@/infrastructure/database/types';
import { MysqlMaxExecutionTimePlugin } from '@/infrastructure/database/reporting/mysql-max-execution-time-plugin';

let runtimeDatabase: Kysely<Database> | undefined;
let runtimeReportingDatabase: Kysely<Database> | undefined;
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
    dateStrings: ['DATE'],
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

export function getRuntimeReportingDatabase(
  environment: Record<string, string | undefined> = process.env,
): Kysely<Database> {
  if (runtimeReportingDatabase === undefined) {
    const configuration = parseRuntimeEnvironment(environment).reportingDatabase;
    runtimeReportingDatabase = createDatabaseClient(configuration).withPlugin(
      new MysqlMaxExecutionTimePlugin(configuration.queryTimeoutMs),
    );
  }
  return runtimeReportingDatabase;
}

export async function destroyDatabaseClients(): Promise<void> {
  const clients = [runtimeDatabase, runtimeReportingDatabase, migrationDatabase].filter(
    (database): database is Kysely<Database> => database !== undefined,
  );

  runtimeDatabase = undefined;
  runtimeReportingDatabase = undefined;
  migrationDatabase = undefined;
  await Promise.all(clients.map(async (database) => database.destroy()));
}
