import type { Kysely } from 'kysely';

import type { DatabaseEnvironment } from '@/infrastructure/config/environment';
import { createDatabaseClient } from '@/infrastructure/database/client';
import type { Database } from '@/infrastructure/database/types';
import { MysqlMaxExecutionTimePlugin } from '@/infrastructure/database/reporting/mysql-max-execution-time-plugin';

export interface ReportingDatabaseClient {
  readonly database: Kysely<Database>;
  close(): Promise<void>;
}

export function createReportingDatabaseClient(
  configuration: DatabaseEnvironment,
): ReportingDatabaseClient {
  const database = createDatabaseClient(configuration).withPlugin(
    new MysqlMaxExecutionTimePlugin(configuration.queryTimeoutMs),
  );
  let closed = false;

  return Object.freeze({
    database,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await database.destroy();
    },
  });
}
