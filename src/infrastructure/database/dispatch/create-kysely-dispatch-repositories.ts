import type { Kysely } from 'kysely';

import type { DispatchRepositories } from '@/application/dispatch/ports/dispatch-transaction';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyDriverRepository } from '@/infrastructure/database/master-data/kysely-driver-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import { KyselyVehicleRepository } from '@/infrastructure/database/master-data/kysely-vehicle-repository';
import type { Database } from '@/infrastructure/database/types';

import { KyselyDispatchRepository } from './kysely-dispatch-repository';
import { KyselyDispatchConflictOverrideRepository } from './kysely-dispatch-conflict-override-repository';
import { KyselyDispatchScheduleRepository } from './kysely-dispatch-schedule-repository';
import { KyselyDispatchScheduleSettingsRepository } from './kysely-dispatch-schedule-settings-repository';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export function createKyselyDispatchRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
): DispatchRepositories {
  return Object.freeze({
    dispatches: new KyselyDispatchRepository(database),
    dispatchSchedules: new KyselyDispatchScheduleRepository(database),
    dispatchConflictOverrides: new KyselyDispatchConflictOverrideRepository(database),
    dispatchScheduleSettings: new KyselyDispatchScheduleSettingsRepository(database),
    offices: new KyselyOfficeRepository(database),
    drivers: new KyselyDriverRepository(database),
    vehicles: new KyselyVehicleRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
