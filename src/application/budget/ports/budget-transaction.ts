import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { BudgetAllocationRepository } from './budget-allocation-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';

export interface BudgetRepositories {
  readonly allocations: BudgetAllocationRepository;
  readonly offices: OfficeRepository;
  readonly auditEvents: AuditEventPort;
}

export interface BudgetTransaction {
  execute<T>(work: (repositories: BudgetRepositories) => Promise<T>): Promise<T>;
}
