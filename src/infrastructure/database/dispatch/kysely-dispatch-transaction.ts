import type { Kysely } from 'kysely';

import type {
  DispatchRepositories,
  DispatchTransaction,
} from '@/application/dispatch/ports/dispatch-transaction';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { DispatchTransactionRetryError } from '@/application/shared/errors/application-error';
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

  async execute<T>(work: (repositories: DispatchRepositories) => Promise<T>): Promise<T> {
    try {
      return await this.database
        .transaction()
        .execute((transaction) =>
          work(createKyselyDispatchRepositories(transaction, this.auditOptions)),
        );
    } catch (error) {
      const code = (error as { code?: unknown }).code;
      if (code === 'ER_LOCK_DEADLOCK' || code === 'ER_LOCK_WAIT_TIMEOUT') {
        throw new DispatchTransactionRetryError();
      }
      throw error;
    }
  }
}
