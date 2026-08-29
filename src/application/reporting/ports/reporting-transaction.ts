import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';

export interface ReportingRepositories {
  readonly exportJobs: ExportJobRepository;
  readonly auditEvents: AuditEventPort;
}

export interface ReportingTransaction {
  execute<T>(work: (repositories: ReportingRepositories) => Promise<T>): Promise<T>;
}
