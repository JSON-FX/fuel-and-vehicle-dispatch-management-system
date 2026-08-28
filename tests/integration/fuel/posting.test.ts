import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CreateFuelIssuance } from '@/application/fuel/use-cases/create-fuel-issuance';
import { PostFuelIssuance } from '@/application/fuel/use-cases/post-fuel-issuance';
import { KyselyFuelTransaction } from '@/infrastructure/database/fuel/kysely-fuel-transaction';
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

describe('fuel posting atomicity', () => {
  it('posts the draft, reserves one RIS, appends one negative ledger row, and audits once', async () => {
    const dependencies = fuelDependencies(database);
    const draft = await new CreateFuelIssuance(dependencies).execute({
      context: fuelContext,
      command: fuelDraftCommand(references, 'POST'),
    });
    const posted = await new PostFuelIssuance(dependencies).execute({
      context: fuelContext,
      publicId: draft.publicId,
      command: { issuedLiters: '30.125' },
    });

    expect(posted).toMatchObject({
      status: 'POSTED',
      risNumber: '2026-08-001',
      issuedLiters: '30.125',
      totalAmount: '1845.16',
    });
    const ledger = await database
      .selectFrom('fuel_ledger_entries')
      .select(['transaction_type', 'quantity', 'signed_quantity'])
      .execute();
    expect(ledger).toEqual([
      { transaction_type: 'ISSUANCE', quantity: '30.125', signed_quantity: '-30.125' },
    ]);
    const audits = await sql<{ count: string }>`
      select count(*) as count from fvdms_audit.audit_outbox
      where action = 'fuel_issuance.posted'
    `.execute(database);
    expect(audits.rows[0]?.count).toBe('1');
  });

  it('rolls back status, sequence, and ledger when audit append fails', async () => {
    const dependencies = fuelDependencies(database);
    const draft = await new CreateFuelIssuance(dependencies).execute({
      context: fuelContext,
      command: fuelDraftCommand(references, 'ROLLBACK'),
    });
    const failing = {
      ...dependencies,
      transaction: new KyselyFuelTransaction(database, {
        primarySchema: 'missing_fuel_audit',
        maximumCanonicalPayloadBytes: 65_536,
      }),
    };

    await expect(
      new PostFuelIssuance(failing).execute({
        context: fuelContext,
        publicId: draft.publicId,
        command: { issuedLiters: '30' },
      }),
    ).rejects.toThrow();
    const row = await database
      .selectFrom('fuel_issuances')
      .select(['status', 'ris_number'])
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ status: 'DRAFT', ris_number: null });
    expect(await database.selectFrom('fuel_sequence_monthly').select('id').execute()).toHaveLength(
      0,
    );
    expect(await database.selectFrom('fuel_ledger_entries').select('id').execute()).toHaveLength(0);
  });
});
