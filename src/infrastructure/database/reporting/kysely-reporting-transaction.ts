import type { Kysely } from 'kysely';

import type {
  ReportingRepositories,
  ReportingTransaction,
} from '@/application/reporting/ports/reporting-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { createKyselyReportingWriteRepositories } from './create-kysely-reporting-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyReportingTransaction implements ReportingTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: ReportingRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) =>
        work(createKyselyReportingWriteRepositories(transaction, this.auditOptions)),
      );
  }
}
