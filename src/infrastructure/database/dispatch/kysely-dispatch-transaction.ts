import type { Kysely } from 'kysely';

import type {
  DispatchRepositories,
  DispatchTransaction,
} from '@/application/dispatch/ports/dispatch-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyDispatchRepositories } from './create-kysely-dispatch-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyDispatchTransaction implements DispatchTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: DispatchRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) =>
        work(createKyselyDispatchRepositories(transaction, this.auditOptions)),
      );
  }
}
