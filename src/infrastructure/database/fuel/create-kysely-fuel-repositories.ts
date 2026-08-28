import type { Kysely } from 'kysely';

import type { FuelRepositories } from '@/application/fuel/ports/fuel-transaction';
import {
  KyselyAuditOutboxStore,
  type AuditOutboxStoreOptions,
} from '@/infrastructure/database/audit/kysely-audit-outbox-store';
import { KyselyBudgetAllocationRepository } from '@/infrastructure/database/budget/kysely-budget-allocation-repository';
import { KyselyDriverRepository } from '@/infrastructure/database/master-data/kysely-driver-repository';
import { KyselyOfficeRepository } from '@/infrastructure/database/master-data/kysely-office-repository';
import { KyselyVehicleRepository } from '@/infrastructure/database/master-data/kysely-vehicle-repository';
import type { Database } from '@/infrastructure/database/types';

import { KyselyFuelIssuanceRepository } from './kysely-fuel-issuance-repository';
import { KyselyFuelLedgerRepository } from './kysely-fuel-ledger-repository';
import { KyselyFuelSequenceRepository } from './kysely-fuel-sequence-repository';

const defaultAuditOptions: AuditOutboxStoreOptions = {
  primarySchema: 'fvdms_audit',
  maximumCanonicalPayloadBytes: 65_536,
};

export function createKyselyFuelRepositories(
  database: Kysely<Database>,
  auditOptions: AuditOutboxStoreOptions = defaultAuditOptions,
): FuelRepositories {
  const ledger = new KyselyFuelLedgerRepository(database);
  return Object.freeze({
    issuances: new KyselyFuelIssuanceRepository(database, undefined, ledger),
    sequences: new KyselyFuelSequenceRepository(database),
    ledger,
    drivers: new KyselyDriverRepository(database),
    vehicles: new KyselyVehicleRepository(database),
    allocations: new KyselyBudgetAllocationRepository(database),
    offices: new KyselyOfficeRepository(database),
    auditEvents: new KyselyAuditOutboxStore(database, auditOptions),
  });
}
