import type { Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';

import { KyselyExportJobRepository } from './kysely-export-job-repository';
import { KyselyReportQueryRepository } from './kysely-report-query-repository';

export function createKyselyReportingReadRepositories(database: Kysely<Database>) {
  return Object.freeze({
    reports: new KyselyReportQueryRepository(database),
  });
}

export function createKyselyReportingWriteRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
) {
  return Object.freeze({
    exportJobs: new KyselyExportJobRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
