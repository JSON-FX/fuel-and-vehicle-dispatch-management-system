import { afterEach, describe, expect, it } from 'vitest';

import { GetHealthStatus } from '@/application/health/use-cases/get-health-status';
import { createApplicationComposition } from '@/infrastructure/composition/root';
import { destroyDatabaseClients } from '@/infrastructure/database/client';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

const environment = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '1',
  DATABASE_NAME: 'fvdms_test',
  DATABASE_USER: 'fvdms_app',
  DATABASE_PASSWORD: 'application-password',
  DATABASE_POOL_MIN: '0',
  DATABASE_POOL_MAX: '2',
  DATABASE_CONNECT_TIMEOUT_MS: '50',
  DATABASE_QUERY_TIMEOUT_MS: '50',
};

afterEach(async () => {
  await destroyDatabaseClients();
});

describe('application composition', () => {
  it('constructs immutable application services without opening a connection', () => {
    const composition = createApplicationComposition(environment);

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.getHealthStatus).toBeInstanceOf(GetHealthStatus);
    expect(composition.publicIdGenerator).toBeInstanceOf(UuidV7Generator);
    expect(composition.logger.info).toBeTypeOf('function');
  });
});
