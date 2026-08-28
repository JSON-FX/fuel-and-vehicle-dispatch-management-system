import type { Kysely } from 'kysely';

import type { FuelRepositories, FuelTransaction } from '@/application/fuel/ports/fuel-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyFuelRepositories } from './create-kysely-fuel-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyFuelTransaction implements FuelTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: FuelRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) => work(createKyselyFuelRepositories(transaction, this.auditOptions)));
  }
}
