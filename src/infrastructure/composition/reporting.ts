import type { Kysely } from 'kysely';

import type { Clock } from '@/application/auth/ports/clock';
import {
  ExportJobExecutor,
  ExportJobWorker,
} from '@/application/reporting/services/export-job-worker';
import { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { DownloadExport } from '@/application/reporting/use-cases/download-export';
import { GetOwnExportJob } from '@/application/reporting/use-cases/get-own-export-job';
import { GetReport } from '@/application/reporting/use-cases/get-report';
import { GetReportFilterOptions } from '@/application/reporting/use-cases/get-report-filter-options';
import { IssueExportDownloadLink } from '@/application/reporting/use-cases/issue-export-download-link';
import { ListOwnExportJobs } from '@/application/reporting/use-cases/list-own-export-jobs';
import { RequestReportExport } from '@/application/reporting/use-cases/request-report-export';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import {
  parseReportingWorkerEnvironment,
  type ReportingPolicyEnvironment,
} from '@/infrastructure/config/environment';
import type { AuditOutboxStoreOptions } from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { createDatabaseClient } from '@/infrastructure/database/client';
import { createReportingDatabaseClient } from '@/infrastructure/database/reporting/client';
import { KyselyExportJobRepository } from '@/infrastructure/database/reporting/kysely-export-job-repository';
import { KyselyReportQueryRepository } from '@/infrastructure/database/reporting/kysely-report-query-repository';
import { KyselyReportRequesterRepository } from '@/infrastructure/database/reporting/kysely-report-requester-repository';
import { KyselyReportingTransaction } from '@/infrastructure/database/reporting/kysely-reporting-transaction';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';
import { ExcelJsReportExporter } from '@/infrastructure/reporting/exceljs-report-exporter';
import { LocalPrivateExportStorage } from '@/infrastructure/reporting/local-private-export-storage';
import { NodeExportDownloadTokenService } from '@/infrastructure/reporting/node-export-download-token-service';

export interface ReportingWebComposition {
  readonly reportPermissions: ReportPermissionPolicy;
  readonly getReport: GetReport;
  readonly getReportFilterOptions: GetReportFilterOptions;
  readonly requestReportExport: RequestReportExport;
  readonly listOwnExportJobs: ListOwnExportJobs;
  readonly getOwnExportJob: GetOwnExportJob;
  readonly issueExportDownloadLink: IssueExportDownloadLink;
  readonly downloadExport: DownloadExport;
}

export interface ReportingWorkerComposition {
  readonly worker: ExportJobWorker;
  readonly pollIntervalMs: number;
  readonly close: () => Promise<void>;
}

export function createReportingWebComposition(
  applicationDatabase: Kysely<Database>,
  reportingDatabase: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions,
  policy: ReportingPolicyEnvironment,
  dependencies: { readonly publicIds: PublicIdGenerator; readonly clock: Clock },
): ReportingWebComposition {
  const queries = new KyselyReportQueryRepository(reportingDatabase);
  const exportJobs = new KyselyExportJobRepository(applicationDatabase);
  const requesters = new KyselyReportRequesterRepository(applicationDatabase);
  const transaction = new KyselyReportingTransaction(applicationDatabase, auditOptions);
  const permissions = new ReportPermissionPolicy();
  const storage = new LocalPrivateExportStorage(policy.storageRoot);
  const tokens = new NodeExportDownloadTokenService();
  const executor = new ExportJobExecutor({
    exportJobs,
    transaction,
    queries,
    requesters,
    permissions,
    exporter: new ExcelJsReportExporter({
      maxRows: policy.maximumRows,
      maxBytes: policy.maximumBytes,
      timeoutMs: policy.timeoutMs,
    }),
    storage,
    ...dependencies,
    retentionMs: policy.retentionMs,
    timeoutMs: policy.timeoutMs,
    leaseDurationMs: policy.leaseMs,
  });
  return Object.freeze({
    reportPermissions: permissions,
    getReport: new GetReport({ queries, permissions, clock: dependencies.clock }),
    getReportFilterOptions: new GetReportFilterOptions({ queries, permissions }),
    requestReportExport: new RequestReportExport({
      queries,
      exportJobs,
      transaction,
      requesters,
      permissions,
      executor,
      ...dependencies,
      synchronousRowLimit: policy.synchronousRowLimit,
      maximumRows: policy.maximumRows,
    }),
    listOwnExportJobs: new ListOwnExportJobs({ exportJobs, requesters }),
    getOwnExportJob: new GetOwnExportJob({ exportJobs, requesters }),
    issueExportDownloadLink: new IssueExportDownloadLink({
      exportJobs,
      transaction,
      requesters,
      permissions,
      tokens,
      clock: dependencies.clock,
      tokenTtlMs: policy.tokenTtlMs,
    }),
    downloadExport: new DownloadExport({
      exportJobs,
      transaction,
      requesters,
      permissions,
      tokens,
      storage,
      ...dependencies,
    }),
  });
}

export function createReportingWorkerComposition(
  environment: Record<string, string | undefined> = process.env,
): ReportingWorkerComposition {
  const configuration = parseReportingWorkerEnvironment(environment);
  const applicationDatabase = createDatabaseClient(configuration.applicationDatabase);
  const reportingClient = createReportingDatabaseClient(configuration.reportingDatabase);
  const exportJobs = new KyselyExportJobRepository(applicationDatabase);
  const requesters = new KyselyReportRequesterRepository(applicationDatabase);
  const transaction = new KyselyReportingTransaction(applicationDatabase, {
    primarySchema: configuration.audit.primarySchema,
    maximumCanonicalPayloadBytes: configuration.audit.maxCanonicalPayloadBytes,
  });
  const permissions = new ReportPermissionPolicy();
  const storage = new LocalPrivateExportStorage(configuration.policy.storageRoot);
  const clock: Clock = Object.freeze({ now: () => new Date() });
  const executor = new ExportJobExecutor({
    exportJobs,
    transaction,
    queries: new KyselyReportQueryRepository(reportingClient.database),
    requesters,
    permissions,
    exporter: new ExcelJsReportExporter({
      maxRows: configuration.policy.maximumRows,
      maxBytes: configuration.policy.maximumBytes,
      timeoutMs: configuration.policy.timeoutMs,
    }),
    storage,
    publicIds: new UuidV7Generator(),
    clock,
    retentionMs: configuration.policy.retentionMs,
    timeoutMs: configuration.policy.timeoutMs,
    leaseDurationMs: configuration.policy.leaseMs,
  });
  let closed = false;
  return Object.freeze({
    worker: new ExportJobWorker({
      exportJobs,
      executor,
      storage,
      clock,
      leaseDurationMs: configuration.policy.leaseMs,
      staleTemporaryMs: configuration.policy.staleTemporaryMs,
    }),
    pollIntervalMs: configuration.policy.pollIntervalMs,
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await Promise.all([applicationDatabase.destroy(), reportingClient.close()]);
    },
  });
}
