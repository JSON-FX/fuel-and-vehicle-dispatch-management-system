import type { Kysely } from 'kysely';

import type { MasterDataRepositories } from '@/application/master-data/ports/master-data-transaction';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import type { Database } from '@/infrastructure/database/types';

import { KyselyDriverRepository } from './kysely-driver-repository';
import { KyselyOfficeRepository } from './kysely-office-repository';
import { KyselyVehicleRepository } from './kysely-vehicle-repository';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export function createKyselyMasterDataRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
): MasterDataRepositories {
  return Object.freeze({
    offices: new KyselyOfficeRepository(database),
    drivers: new KyselyDriverRepository(database),
    vehicles: new KyselyVehicleRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
