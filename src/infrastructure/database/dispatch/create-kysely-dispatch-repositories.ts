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
    offices: new KyselyOfficeRepository(database),
    drivers: new KyselyDriverRepository(database),
    vehicles: new KyselyVehicleRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
