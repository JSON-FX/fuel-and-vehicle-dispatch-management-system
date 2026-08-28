import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { FuelIssuanceListQuery } from '@/application/fuel/dto/fuel-dtos';
import { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { KyselyFuelIssuanceRepository } from '@/infrastructure/database/fuel/kysely-fuel-issuance-repository';
import { KyselyFuelLedgerRepository } from '@/infrastructure/database/fuel/kysely-fuel-ledger-repository';
import { KyselyFuelSequenceRepository } from '@/infrastructure/database/fuel/kysely-fuel-sequence-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  fuelActorPublicId,
  fuelPublicId,
  fuelTestAt,
  prepareFuelDatabase,
  resetFuelDatabase,
  seedFuelReferences,
  type FuelReferenceFixture,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let references: FuelReferenceFixture;
let issuances: KyselyFuelIssuanceRepository;
let ledger: KyselyFuelLedgerRepository;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareFuelDatabase(database);
});

beforeEach(async () => {
  await resetFuelDatabase(database);
  references = await seedFuelReferences(database);
  ledger = new KyselyFuelLedgerRepository(database);
  issuances = new KyselyFuelIssuanceRepository(database, undefined, ledger);
});

afterAll(async () => {
  await database.destroy();
});

function draft(id: number, entryDate = '2026-08-28'): FuelIssuance {
  return new FuelIssuance({
    publicId: fuelPublicId(id),
    purchaseRequestNumber: PurchaseRequestNumber.from(`PR-2026-${id}`),
    entryDate: EntryDate.from(entryDate),
    driverPublicId: references.driver.publicId,
    destination: 'AOR',
    purpose: `Repository proof ${id}`,
    vehiclePublicId: references.vehicle.publicId,
    requestedLiters: FuelQuantity.from('30'),
    isFullTank: false,
    issuedLiters: null,
    unitPrice: UnitPrice.from('61.25'),
    budgetAllocationPublicId: references.allocation.publicId,
    fuelType: FuelType.diesel(),
    createdByActorPublicId: fuelActorPublicId,
    createdAt: fuelTestAt,
    updatedAt: fuelTestAt,
  });
}

const listQuery: FuelIssuanceListQuery = {
  query: null,
  status: null,
  fuelType: null,
  startDate: null,
  endDate: null,
  cursor: null,
  pageSize: 1,
};

describe('fuel repositories', () => {
  it('maps civil dates, decimal strings, historical labels, and draft updates', async () => {
    const target = draft(620);
    await issuances.insert(target);

    const stored = await issuances.findByPublicId(target.publicId.toString());
    expect(stored).toMatchObject({
      driver: { name: 'Juan Dela Cruz' },
      vehicle: {
        plateNumber: 'ABC-123',
        modelBrand: 'Toyota Hiace',
        vehicleType: 'Passenger Van',
      },
      allocation: {
        ppmpNumber: 'PPMP-2026-01',
        office: { name: 'Provincial Services Office', abbreviation: 'PSO' },
      },
    });
    expect(stored?.issuance.entryDate.toString()).toBe('2026-08-28');
    expect(stored?.issuance.unitPrice.toString()).toBe('61.25');

    target.updateDraft(
      {
        purchaseRequestNumber: PurchaseRequestNumber.from('PR-UPDATED'),
        entryDate: EntryDate.from('2026-08-29'),
        driverPublicId: target.driverPublicId,
        destination: 'Provincial Capitol',
        purpose: 'Updated repository proof',
        vehiclePublicId: target.vehiclePublicId,
        requestedLiters: null,
        isFullTank: true,
        issuedLiters: FuelQuantity.from('40.125'),
        unitPrice: UnitPrice.from('62.10'),
        budgetAllocationPublicId: target.budgetAllocationPublicId,
        fuelType: FuelType.gasoline(),
      },
      new Date('2026-08-28T11:00:00.000Z'),
    );
    await issuances.updateDraft(target);

    expect((await issuances.findByPublicId(target.publicId.toString()))?.issuance).toMatchObject({
      destination: 'Provincial Capitol',
      isFullTank: true,
    });
  });

  it('lists in stable entry-date order and binds cursors to every filter', async () => {
    await issuances.insert(draft(621, '2026-08-27'));
    await issuances.insert(draft(622, '2026-08-28'));

    const first = await issuances.list(listQuery);
    expect(first.items[0]?.issuance.publicId.toString()).toBe(fuelPublicId(622).toString());
    expect(first.nextCursor).not.toBeNull();
    const second = await issuances.list({ ...listQuery, cursor: first.nextCursor });
    expect(second.items[0]?.issuance.publicId.toString()).toBe(fuelPublicId(621).toString());
    await expect(
      issuances.list({ ...listQuery, status: 'DRAFT', cursor: first.nextCursor }),
    ).rejects.toThrow();
  });

  it('persists posted facts and maps linked immutable ledger entries', async () => {
    const target = draft(623);
    await issuances.insert(target);
    const quantity = FuelQuantity.from('30.125');
    target.post({
      risNumber: RisNumber.issue(target.entryDate, 1),
      issuedLiters: quantity,
      totalAmount: FuelTotal.calculate(quantity, target.unitPrice),
      at: new Date('2026-08-28T12:00:00.000Z'),
    });
    await issuances.markPosted(target);
    await ledger.append(
      FuelLedgerEntry.issuance({
        publicId: fuelPublicId(624),
        fuelIssuancePublicId: target.publicId,
        fuelType: target.fuelType,
        quantity,
        effectiveDate: target.entryDate,
        reference: target.risNumber!.toString(),
        createdAt: target.postedAt!,
      }),
    );

    const detail = await issuances.findDetailByPublicId(target.publicId.toString());
    expect(detail?.issuance.risNumber?.toString()).toBe('2026-08-001');
    expect(detail?.issuance.totalAmount?.toString()).toBe('1845.16');
    expect(detail?.ledgerEntries).toHaveLength(1);
    expect(detail?.ledgerEntries[0]?.signedQuantity.toString()).toBe('-30.125');
  });

  it('increments a locked monthly sequence, resets by month, and continues above 999', async () => {
    const next = async (year: number, month: number) =>
      database
        .transaction()
        .execute(async (transaction) =>
          new KyselyFuelSequenceRepository(transaction).next({ year, month, at: fuelTestAt }),
        );

    await expect(next(2026, 8)).resolves.toBe(1);
    await expect(next(2026, 8)).resolves.toBe(2);
    await expect(next(2026, 9)).resolves.toBe(1);
    await database
      .updateTable('fuel_sequence_monthly')
      .set({ last_number: 999 })
      .where('sequence_year', '=', 2026)
      .where('sequence_month', '=', 8)
      .execute();
    await expect(next(2026, 8)).resolves.toBe(1_000);
  });
});
