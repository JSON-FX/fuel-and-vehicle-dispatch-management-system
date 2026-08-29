import type { Kysely } from 'kysely';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export const budgetAdministratorPublicId = PublicId.from('01900000-0000-7000-8000-000000000301');

export async function prepareBudgetDatabase(database: Kysely<Database>): Promise<void> {
  const migration = await createMigrator(database).migrateToLatest();
  if (migration.error !== undefined) throw migration.error;
  await resetBudgetDatabase(database);
}

export async function resetBudgetDatabase(database: Kysely<Database>): Promise<void> {
  await database.withSchema('fvdms_audit').deleteFrom('audit_outbox').execute();
  await database.deleteFrom('export_download_tokens').execute();
  await database.deleteFrom('export_jobs').execute();
  await database.deleteFrom('vehicle_dispatch_conflict_overrides').execute();
  await database.deleteFrom('vehicle_dispatches').execute();
  await database.deleteFrom('fuel_ledger_entries').execute();
  await database.deleteFrom('fuel_issuances').execute();
  await database.deleteFrom('fuel_sequence_monthly').execute();
  await database
    .updateTable('dispatch_schedule_settings')
    .set({
      policy: 'WARN_AND_ACK',
      updated_by_user_id: null,
      updated_at: new Date('2026-08-29T00:00:00.000Z'),
    })
    .where('id', '=', 1)
    .execute();
  await database.deleteFrom('budget_allocations').execute();
  await database.deleteFrom('vehicles').execute();
  await database.deleteFrom('drivers').execute();
  await database.deleteFrom('offices').execute();
  await database.deleteFrom('user_totp_factors').execute();
  await database.deleteFrom('user_sessions').execute();
  await database.deleteFrom('user_roles').execute();
  await database.deleteFrom('users').execute();

  const at = new Date('2026-08-28T10:00:00.000Z');
  await database
    .insertInto('users')
    .values({
      public_id: publicIdToBinary(budgetAdministratorPublicId),
      username: 'budget.admin',
      email: 'budget.admin@example.lan',
      full_name: 'Budget Administrator',
      password_hash: 'test-only',
      is_active: true,
      must_change_password: false,
      deleted_at: null,
      created_at: at,
      updated_at: at,
    })
    .execute();
}
