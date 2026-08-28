import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { BudgetAllocationRepository } from '@/application/budget/ports/budget-allocation-repository';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { FuelIssuanceRepository } from '@/application/fuel/ports/fuel-issuance-repository';
import type { FuelLedgerRepository } from '@/application/fuel/ports/fuel-ledger-repository';
import type { FuelSequenceRepository } from '@/application/fuel/ports/fuel-sequence-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';

export interface FuelRepositories {
  readonly issuances: FuelIssuanceRepository;
  readonly sequences: FuelSequenceRepository;
  readonly ledger: FuelLedgerRepository;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
  readonly allocations: BudgetAllocationRepository;
  readonly offices: OfficeRepository;
  readonly auditEvents: AuditEventPort;
}

export interface FuelTransaction {
  execute<T>(work: (repositories: FuelRepositories) => Promise<T>): Promise<T>;
}
