import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import { KyselyFuelLedgerRepository } from '@/infrastructure/database/fuel/kysely-fuel-ledger-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  fuelPublicId,
  fuelTestAt,
  prepareFuelDatabase,
  resetFuelDatabase,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let repository: KyselyFuelLedgerRepository;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareFuelDatabase(database);
});

beforeEach(async () => {
  await resetFuelDatabase(database);
  repository = new KyselyFuelLedgerRepository(database);
});

afterAll(async () => {
  await database.destroy();
});

async function append(input: {
  id: number;
  type: 'OPENING' | 'RECEIPT' | 'ADJUSTMENT';
  fuelType: 'DIESEL' | 'GASOLINE';
  quantity: string;
  signed: string;
  date: string;
}): Promise<void> {
  await repository.append(
    new FuelLedgerEntry({
      publicId: fuelPublicId(input.id),
      fuelIssuancePublicId: null,
      fuelType: FuelType.from(input.fuelType),
      transactionType: input.type,
      quantity: FuelQuantity.from(input.quantity),
      signedQuantity: DecimalValue.from(input.signed),
      effectiveDate: EntryDate.from(input.date),
      reference: `FIXTURE-${input.id}`,
      createdAt: fuelTestAt,
    }),
  );
}

describe('fuel balance repository', () => {
  it('reconciles pre-period opening and inclusive receipts and adjustments by type', async () => {
    await append({
      id: 650,
      type: 'OPENING',
      fuelType: 'DIESEL',
      quantity: '100',
      signed: '100',
      date: '2026-07-31',
    });
    await append({
      id: 651,
      type: 'RECEIPT',
      fuelType: 'DIESEL',
      quantity: '50',
      signed: '50',
      date: '2026-08-01',
    });
    await append({
      id: 652,
      type: 'ADJUSTMENT',
      fuelType: 'DIESEL',
      quantity: '5',
      signed: '-5',
      date: '2026-08-31',
    });
    await append({
      id: 653,
      type: 'OPENING',
      fuelType: 'GASOLINE',
      quantity: '25',
      signed: '25',
      date: '2026-07-31',
    });

    const balances = await repository.summarize({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      fuelType: null,
    });

    expect(balances).toEqual([
      {
        fuelType: 'DIESEL',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        opening: '100.000',
        receipts: '50.000',
        adjustments: '-5.000',
        issuances: '0.000',
        netMovement: '45.000',
        closing: '145.000',
      },
      {
        fuelType: 'GASOLINE',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        opening: '25.000',
        receipts: '0.000',
        adjustments: '0.000',
        issuances: '0.000',
        netMovement: '0.000',
        closing: '25.000',
      },
    ]);
  });

  it('returns a zero summary for the selected type without activity', async () => {
    await expect(
      repository.summarize({
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        fuelType: 'GASOLINE',
      }),
    ).resolves.toEqual([
      {
        fuelType: 'GASOLINE',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        opening: '0.000',
        receipts: '0.000',
        adjustments: '0.000',
        issuances: '0.000',
        netMovement: '0.000',
        closing: '0.000',
      },
    ]);
  });
});
