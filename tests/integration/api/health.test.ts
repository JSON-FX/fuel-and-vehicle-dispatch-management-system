import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';

import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import type { Logger } from '@/application/shared/ports/logger';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { KyselyHealthCheckRepository } from '@/infrastructure/database/health/kysely-health-check-repository';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { withApiHandler } from '@/lib/http/with-api-handler';

import { createTestDatabase } from '../helpers/test-database';

const requestId = '019c043f-422c-7141-8a03-a9d9bda3544a';
const logger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => logger),
};
let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const result = await createMigrator(database).migrateToLatest();
  expect(result.error).toBeUndefined();
});

afterAll(async () => {
  await database.destroy();
});

function healthHandler(healthDatabase: Kysely<Database>, timeoutMs = 2_000) {
  const useCase = new GetHealthStatus(new KyselyHealthCheckRepository(healthDatabase, timeoutMs));

  return withApiHandler(
    {
      logger,
      publicIdGenerator: { generate: () => PublicId.from(requestId) },
    },
    async () => useCase.execute(),
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

describe('database-aware health API', () => {
  it('returns readiness after a real MySQL query', async () => {
    const response = await healthHandler(database)(new Request('https://fvdms.lan/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('ok');
    expect(body.data.database).toBe('available');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns a sanitized dependency error for a real driver failure', async () => {
    const unavailableDatabase = new Kysely<Database>({
      dialect: new MysqlDialect({
        pool: createPool({ host: '127.0.0.1', port: 1, connectTimeout: 50 }),
      }),
    });

    try {
      const response = await healthHandler(
        unavailableDatabase,
        100,
      )(new Request('https://fvdms.lan/api/health'));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|mysql|sql/i);
    } finally {
      await unavailableDatabase.destroy();
    }
  });
});
