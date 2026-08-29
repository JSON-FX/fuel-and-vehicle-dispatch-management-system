import { describe, expect, it } from 'vitest';

import { createReportingDatabaseClient } from '@/infrastructure/database/reporting/client';

describe('reporting database client', () => {
  it('owns a dedicated connection and closes it idempotently', async () => {
    const client = createReportingDatabaseClient({
      host: '127.0.0.1',
      port: 1,
      name: 'fvdms',
      user: 'fvdms_reporter',
      password: 'reporter-password',
      poolMin: 0,
      poolMax: 1,
      connectTimeoutMs: 50,
      queryTimeoutMs: 100,
    });

    expect(client.database).toBeDefined();
    expect(client.database.selectFrom('offices').select('id').compile().sql).toContain(
      'select /*+ MAX_EXECUTION_TIME(100) */',
    );
    expect(client.close).toBeTypeOf('function');
    await client.close();
    await expect(client.close()).resolves.toBeUndefined();
  });
});
