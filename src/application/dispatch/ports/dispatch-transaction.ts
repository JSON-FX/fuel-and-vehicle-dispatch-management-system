import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { DriverRepository } from '@/application/driver/ports/driver-repository';
import type { DispatchConflictOverrideRepository } from '@/application/dispatch/ports/dispatch-conflict-override-repository';
import type { DispatchRepository } from '@/application/dispatch/ports/dispatch-repository';
import type { DispatchScheduleRepository } from '@/application/dispatch/ports/dispatch-schedule-repository';
import type { DispatchScheduleSettingsRepository } from '@/application/dispatch/ports/dispatch-schedule-settings-repository';
import type { OfficeRepository } from '@/application/office/ports/office-repository';
import type { VehicleRepository } from '@/application/vehicle/ports/vehicle-repository';

export interface DispatchRepositories {
  readonly dispatches: DispatchRepository;
  readonly dispatchSchedules: DispatchScheduleRepository;
  readonly dispatchConflictOverrides: DispatchConflictOverrideRepository;
  readonly dispatchScheduleSettings: DispatchScheduleSettingsRepository;
  readonly offices: OfficeRepository;
  readonly drivers: DriverRepository;
  readonly vehicles: VehicleRepository;
  readonly auditEvents: AuditEventPort;
}

export interface DispatchTransaction {
  execute<T>(work: (repositories: DispatchRepositories) => Promise<T>): Promise<T>;
}
