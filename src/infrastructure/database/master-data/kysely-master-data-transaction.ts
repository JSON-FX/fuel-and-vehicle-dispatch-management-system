import type { Kysely } from 'kysely';

import type {
  MasterDataRepositories,
  MasterDataTransaction,
} from '@/application/master-data/ports/master-data-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyMasterDataRepositories } from './create-kysely-master-data-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyMasterDataTransaction implements MasterDataTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: MasterDataRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) =>
        work(createKyselyMasterDataRepositories(transaction, this.auditOptions)),
      );
  }
}
