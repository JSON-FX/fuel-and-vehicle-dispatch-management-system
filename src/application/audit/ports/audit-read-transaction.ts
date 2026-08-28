import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { AuditQueryRepository } from '@/application/audit/ports/audit-query-repository';

export interface AuditReadRepositories {
  readonly queries: AuditQueryRepository;
  readonly auditEvents: AuditEventPort;
}

export interface AuditReadTransaction {
  execute<T>(work: (repositories: AuditReadRepositories) => Promise<T>): Promise<T>;
}
