import type { Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const migration = await createMigrator(database).migrateToLatest();
  expect(migration.error).toBeUndefined();
  await resetDemoSeedFixtures(database);
  await createSeedActor(database);
});

afterAll(async () => {
  await resetDemoSeedFixtures(database);
  await database.destroy();
});

describe('demo database seeding', () => {
  it('creates exact, relationally valid operational counts and refuses a duplicate batch', async () => {
    const { seedDemoData } = await import('@/../scripts/database/seed-demo');
    const input = { count: 100, now: new Date('2026-08-29T08:00:00.000Z') };

    const result = await seedDemoData(database, input);

    expect(result).toMatchObject({ count: 100, fuelIssuances: 50, dispatches: 50 });
    await expect(operationalCounts(database)).resolves.toEqual({
      dispatches: 50,
      fuelIssuances: 50,
    });
    await expect(statusCounts(database, 'fuel_issuances')).resolves.toEqual({
      DRAFT: 5,
      POSTED: 40,
      VOIDED: 5,
    });
    await expect(statusCounts(database, 'vehicle_dispatches')).resolves.toEqual({
      CANCELLED: 5,
      COMPLETED: 30,
      DISPATCHED: 10,
      DRAFT: 5,
    });

    const posted = await database
      .selectFrom('fuel_issuances')
      .select(['issued_liters', 'unit_price', 'total_amount'])
      .where('status', '=', 'POSTED')
      .executeTakeFirstOrThrow();
    expect(Number(posted.total_amount)).toBe(
      Number((Number(posted.issued_liters) * Number(posted.unit_price)).toFixed(2)),
    );

    const ledgerCounts = await database
      .selectFrom('fuel_ledger_entries')
      .select(['transaction_type', (expression) => expression.fn.countAll<string>().as('count')])
      .where('fuel_issuance_id', 'is not', null)
      .groupBy('transaction_type')
      .orderBy('transaction_type')
      .execute();
    expect(
      Object.fromEntries(ledgerCounts.map((row) => [row.transaction_type, Number(row.count)])),
    ).toEqual({ ADJUSTMENT: 5, ISSUANCE: 45 });

    await expect(seedDemoData(database, input)).rejects.toThrow(
      'Demo data has already been seeded. Run the guarded database reset before seeding again.',
    );
    await expect(operationalCounts(database)).resolves.toEqual({
      dispatches: 50,
      fuelIssuances: 50,
    });
  });
});

async function createSeedActor(target: Kysely<Database>): Promise<void> {
  const role = await target
    .selectFrom('roles')
    .select('id')
    .where('code', '=', 'SUPER_ADMIN')
    .executeTakeFirstOrThrow();
  const user = await target
    .insertInto('users')
    .values({
      public_id: publicIdToBinary(PublicId.from('019e1000-0000-7000-8000-000000000001')),
      username: 'demo.seed.actor',
      email: 'demo.seed.actor@example.lan',
      full_name: 'Demo Seed Actor',
      password_hash: 'not-used-by-this-test',
      is_active: true,
      must_change_password: false,
      deleted_at: null,
      created_at: new Date('2026-08-29T07:00:00.000Z'),
      updated_at: new Date('2026-08-29T07:00:00.000Z'),
    })
    .executeTakeFirstOrThrow();
  await target
    .insertInto('user_roles')
    .values({
      user_id: String(user.insertId),
      role_id: role.id,
      assigned_by_user_id: null,
      created_at: new Date('2026-08-29T07:00:00.000Z'),
    })
    .execute();
}

async function operationalCounts(target: Kysely<Database>) {
  const [fuel, dispatch] = await Promise.all([
    target
      .selectFrom('fuel_issuances')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow(),
    target
      .selectFrom('vehicle_dispatches')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow(),
  ]);
  return { dispatches: Number(dispatch.count), fuelIssuances: Number(fuel.count) };
}

async function statusCounts(
  target: Kysely<Database>,
  table: 'fuel_issuances' | 'vehicle_dispatches',
): Promise<Record<string, number>> {
  const rows = await target
    .selectFrom(table)
    .select(['status', (expression) => expression.fn.countAll<string>().as('count')])
    .groupBy('status')
    .orderBy('status')
    .execute();
  return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
}

async function resetDemoSeedFixtures(target: Kysely<Database>): Promise<void> {
  await target.withSchema('fvdms_audit').deleteFrom('audit_outbox').execute();
  await target.deleteFrom('export_download_tokens').execute();
  await target.deleteFrom('export_jobs').execute();
  await target.deleteFrom('vehicle_dispatch_conflict_overrides').execute();
  await target.deleteFrom('vehicle_dispatches').execute();
  await target.deleteFrom('fuel_ledger_entries').execute();
  await target.deleteFrom('fuel_issuances').execute();
  await target.deleteFrom('fuel_sequence_monthly').execute();
  await target.deleteFrom('budget_allocations').execute();
  await target
    .updateTable('dispatch_schedule_settings')
    .set({ updated_by_user_id: null })
    .execute();
  await target.updateTable('authentication_settings').set({ updated_by_user_id: null }).execute();
  await target.deleteFrom('offices').execute();
  await target.deleteFrom('drivers').execute();
  await target.deleteFrom('vehicles').execute();
  await target.deleteFrom('admin_password_resets').execute();
  await target.deleteFrom('authentication_challenges').execute();
  await target.deleteFrom('user_sessions').execute();
  await target.deleteFrom('user_totp_factors').execute();
  await target.deleteFrom('login_rate_limits').execute();
  await target.deleteFrom('user_roles').execute();
  await target.deleteFrom('users').execute();
  await target
    .deleteFrom('application_metadata')
    .where('metadata_key', '=', 'demo.seed.v1')
    .execute();
}
