import type { Kysely } from 'kysely';

import type {
  BudgetRepositories,
  BudgetTransaction,
} from '@/application/budget/ports/budget-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyBudgetRepositories } from './create-kysely-budget-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyBudgetTransaction implements BudgetTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: BudgetRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) =>
        work(createKyselyBudgetRepositories(transaction, this.auditOptions)),
      );
  }
}
