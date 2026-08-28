import type { Kysely } from 'kysely';

import type { DatabaseEnvironment } from '@/infrastructure/config/environment';
import { createDatabaseClient } from '@/infrastructure/database/client';
import type { Database } from '@/infrastructure/database/types';

export interface TestDatabaseConfiguration {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly administratorUser: string;
  readonly administratorPassword: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    mysql: TestDatabaseConfiguration;
  }
}

export function createTestDatabase(configuration: TestDatabaseConfiguration): Kysely<Database> {
  const environment: DatabaseEnvironment = {
    host: configuration.host,
    port: configuration.port,
    name: configuration.database,
    user: configuration.user,
    password: configuration.password,
    poolMin: 0,
    poolMax: 4,
    connectTimeoutMs: 5_000,
    queryTimeoutMs: 2_000,
  };

  return createDatabaseClient(environment);
}
