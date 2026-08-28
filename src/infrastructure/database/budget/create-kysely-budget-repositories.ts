import type { Kysely } from 'kysely';

import type { BudgetRepositories } from '@/application/budget/ports/budget-transaction';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import type { Database } from '@/infrastructure/database/types';

import { KyselyBudgetAllocationRepository } from './kysely-budget-allocation-repository';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export function createKyselyBudgetRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
): BudgetRepositories {
  return Object.freeze({
    allocations: new KyselyBudgetAllocationRepository(database),
    offices: new KyselyOfficeRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
