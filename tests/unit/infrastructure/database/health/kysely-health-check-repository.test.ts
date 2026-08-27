import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { afterEach, describe, expect, it } from 'vitest';

import { ExternalDependencyError } from '@/application/shared/errors/application-error';
import { KyselyHealthCheckRepository } from '@/infrastructure/database/health/kysely-health-check-repository';
import type { Database } from '@/infrastructure/database/types';

const databases: Kysely<Database>[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.destroy()));
});

describe('KyselyHealthCheckRepository', () => {
  it('maps a driver failure to a typed dependency error', async () => {
    const database = new Kysely<Database>({
      dialect: new MysqlDialect({
        pool: createPool({
          host: '127.0.0.1',
          port: 1,
          user: 'unavailable',
          connectTimeout: 50,
        }),
      }),
    });
    databases.push(database);
    const repository = new KyselyHealthCheckRepository(database, 100);

    await expect(repository.check()).rejects.toBeInstanceOf(ExternalDependencyError);
  });
});
