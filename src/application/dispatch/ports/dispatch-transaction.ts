import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { DispatchRepository } from '@/application/dispatch/ports/dispatch-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';

export interface DispatchRepositories {
  readonly dispatches: DispatchRepository;
  readonly offices: OfficeRepository;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
  readonly auditEvents: AuditEventPort;
}

export interface DispatchTransaction {
  execute<T>(work: (repositories: DispatchRepositories) => Promise<T>): Promise<T>;
}
