import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';

export interface MasterDataRepositories {
  readonly offices: OfficeRepository;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
  readonly auditEvents: AuditEventPort;
}

export interface MasterDataTransaction {
  execute<T>(work: (repositories: MasterDataRepositories) => Promise<T>): Promise<T>;
}
