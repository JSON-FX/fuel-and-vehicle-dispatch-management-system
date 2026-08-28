import type { Kysely } from 'kysely';

import type { AuditProcessEnvironment } from '@/infrastructure/config/environment';
import { createDatabaseClient } from '@/infrastructure/database/client';
import type { Database } from '@/infrastructure/database/types';

export interface AuditDatabaseClients {
  readonly primary: Kysely<Database>;
  readonly sink: Kysely<Database>;
  close(): Promise<void>;
}

export function createAuditDatabaseClients(
  configuration: AuditProcessEnvironment,
): AuditDatabaseClients {
  const primary = createDatabaseClient(configuration.primaryDatabase);
  const sink = createDatabaseClient(configuration.sinkDatabase);
  let closed = false;
  return Object.freeze({
    primary,
    sink,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await Promise.all([primary.destroy(), sink.destroy()]);
    },
  });
}
