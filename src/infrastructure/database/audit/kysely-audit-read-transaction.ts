import type { Kysely } from 'kysely';

import type {
  AuditReadRepositories,
  AuditReadTransaction,
} from '@/application/audit/ports/audit-read-transaction';
import type { Database } from '@/infrastructure/database/types';

import { KyselyAuditOutboxStore } from './kysely-audit-outbox-store';
import { KyselyAuditQueryRepository } from './kysely-audit-query-repository';

export interface AuditReadTransactionOptions {
  readonly primarySchema: string;
  readonly maximumCanonicalPayloadBytes: number;
}

export class KyselyAuditReadTransaction implements AuditReadTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly options: AuditReadTransactionOptions,
  ) {}

  execute<T>(work: (repositories: AuditReadRepositories) => Promise<T>): Promise<T> {
    return this.database.transaction().execute((transaction) =>
      work({
        queries: new KyselyAuditQueryRepository(transaction, this.options),
        auditEvents: new KyselyAuditOutboxStore(transaction, this.options),
      }),
    );
  }
}
