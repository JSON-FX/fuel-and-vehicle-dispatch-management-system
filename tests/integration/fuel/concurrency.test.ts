import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import { CreateFuelIssuance } from '@/application/fuel/use-cases/create-fuel-issuance';
import { PostFuelIssuance } from '@/application/fuel/use-cases/post-fuel-issuance';
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

describe('fuel posting concurrency', () => {
  it('serializes first-of-month posts into distinct consecutive RIS values', async () => {
    const dependencies = fuelDependencies(database);
    const create = new CreateFuelIssuance(dependencies);
    const drafts = await Promise.all(
      ['A', 'B'].map((suffix) =>
        create.execute({ context: fuelContext, command: fuelDraftCommand(references, suffix) }),
      ),
    );
    const post = new PostFuelIssuance(dependencies);
    const results = await Promise.all(
      drafts.map((draft) =>
        post.execute({
          context: fuelContext,
          publicId: draft.publicId,
          command: { issuedLiters: '30' },
        }),
      ),
    );

    expect(results.map((result) => result.risNumber).sort()).toEqual([
      '2026-08-001',
      '2026-08-002',
    ]);
  });

  it('allows one winner when the same draft is posted concurrently without a sequence gap', async () => {
    const dependencies = fuelDependencies(database);
    const draft = await new CreateFuelIssuance(dependencies).execute({
      context: fuelContext,
      command: fuelDraftCommand(references, 'SAME'),
    });
    const post = new PostFuelIssuance(dependencies);
    const results = await Promise.allSettled([
      post.execute({
        context: fuelContext,
        publicId: draft.publicId,
        command: { issuedLiters: '30' },
      }),
      post.execute({
        context: fuelContext,
        publicId: draft.publicId,
        command: { issuedLiters: '30' },
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { httpStatus: 422 },
    });
    expect(
      await database
        .selectFrom('fuel_sequence_monthly')
        .select('last_number')
        .executeTakeFirstOrThrow(),
    ).toEqual({ last_number: 1 });
    expect(await database.selectFrom('fuel_ledger_entries').select('id').execute()).toHaveLength(1);
  });
});
