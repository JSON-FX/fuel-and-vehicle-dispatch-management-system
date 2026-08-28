import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CreateFuelIssuance } from '@/application/fuel/use-cases/create-fuel-issuance';
import { GetFuelBalances } from '@/application/fuel/use-cases/get-fuel-balances';
import { PostFuelIssuance } from '@/application/fuel/use-cases/post-fuel-issuance';
import { VoidFuelIssuance } from '@/application/fuel/use-cases/void-fuel-issuance';
import type { Database } from '@/infrastructure/database/types';

import {
  fuelContext,
  fuelDependencies,
  fuelDraftCommand,
  prepareFuelDatabase,
  resetFuelDatabase,
  seedFuelReferences,
  type FuelReferenceFixture,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let references: FuelReferenceFixture;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareFuelDatabase(database);
});
beforeEach(async () => {
  await resetFuelDatabase(database);
  references = await seedFuelReferences(database);
});
afterAll(async () => database.destroy());

describe('fuel voiding', () => {
  it('keeps the original issuance entry and appends an equal positive adjustment', async () => {
    const dependencies = fuelDependencies(database);
    const draft = await new CreateFuelIssuance(dependencies).execute({
      context: fuelContext,
      command: fuelDraftCommand(references, 'VOID'),
    });
    await new PostFuelIssuance(dependencies).execute({
      context: fuelContext,
      publicId: draft.publicId,
      command: { issuedLiters: '30' },
    });
    const voided = await new VoidFuelIssuance(dependencies).execute({
      context: fuelContext,
      publicId: draft.publicId,
      command: { reason: 'Duplicate dispatch entry' },
    });

    expect(voided).toMatchObject({ status: 'VOIDED', voidReason: 'Duplicate dispatch entry' });
    const ledger = await database
      .selectFrom('fuel_ledger_entries')
      .select(['transaction_type', 'signed_quantity'])
      .orderBy('created_at')
      .execute();
    expect(ledger).toEqual([
      { transaction_type: 'ISSUANCE', signed_quantity: '-30.000' },
      { transaction_type: 'ADJUSTMENT', signed_quantity: '30.000' },
    ]);
    const balances = await new GetFuelBalances(dependencies).execute({
      context: fuelContext,
      query: { startDate: '2026-08-01', endDate: '2026-08-31', fuelType: 'DIESEL' },
    });
    expect(balances[0]).toMatchObject({
      issuances: '30.000',
      adjustments: '30.000',
      closing: '0.000',
    });
  });

  it('allows exactly one concurrent void', async () => {
    const dependencies = fuelDependencies(database);
    const draft = await new CreateFuelIssuance(dependencies).execute({
      context: fuelContext,
      command: fuelDraftCommand(references, 'VOID-RACE'),
    });
    await new PostFuelIssuance(dependencies).execute({
      context: fuelContext,
      publicId: draft.publicId,
      command: { issuedLiters: '30' },
    });
    const voidIssuance = new VoidFuelIssuance(dependencies);
    const results = await Promise.allSettled([
      voidIssuance.execute({
        context: fuelContext,
        publicId: draft.publicId,
        command: { reason: 'First duplicate entry' },
      }),
      voidIssuance.execute({
        context: fuelContext,
        publicId: draft.publicId,
        command: { reason: 'Second duplicate entry' },
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { httpStatus: 422 },
    });
    expect(
      await database
        .selectFrom('fuel_ledger_entries')
        .select('id')
        .where('transaction_type', '=', 'ADJUSTMENT')
        .execute(),
    ).toHaveLength(1);
  });
});
