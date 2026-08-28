import type { Kysely } from 'kysely';

import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Database } from '@/infrastructure/database/types';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';

import { createKyselyAuthRepositories } from './create-kysely-auth-repositories';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export class KyselyAuthTransaction implements AuthTransaction {
  constructor(
    private readonly database: Kysely<Database>,
    private readonly auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
  ) {}

  execute<T>(work: (repositories: AuthRepositories) => Promise<T>): Promise<T> {
    return this.database
      .transaction()
      .execute((transaction) => work(createKyselyAuthRepositories(transaction, this.auditOptions)));
  }
}
