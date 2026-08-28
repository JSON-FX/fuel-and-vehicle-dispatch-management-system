import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const result = await createMigrator(database).migrateToLatest();
  expect(result.error).toBeUndefined();
});

afterAll(async () => {
  await database.destroy();
});

describe('budget allocation migration', () => {
  it('creates the normalized table with named constraints and useful indexes', async () => {
    const columns = await sql<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      DATETIME_PRECISION: number | null;
    }>`
      select COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'budget_allocations'
    `.execute(database);
    const byName = new Map(columns.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(byName.get('id')).toMatchObject({ COLUMN_TYPE: 'bigint unsigned', IS_NULLABLE: 'NO' });
    expect(byName.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(byName.get('ppmp_number')?.COLUMN_TYPE).toBe('varchar(80)');
    expect(byName.get('office_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('quarter')?.COLUMN_TYPE).toBe('tinyint unsigned');
    expect(byName.get('fiscal_year')?.COLUMN_TYPE).toBe('smallint unsigned');
    expect(byName.get('status')?.COLUMN_TYPE).toBe('varchar(9)');
    expect(byName.get('created_at')?.DATETIME_PRECISION).toBe(6);

    const constraints = await sql<{ CONSTRAINT_NAME: string; CONSTRAINT_TYPE: string }>`
      select CONSTRAINT_NAME, CONSTRAINT_TYPE
      from information_schema.table_constraints
      where table_schema = database() and table_name = 'budget_allocations'
    `.execute(database);
    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        { CONSTRAINT_NAME: 'uq_budget_allocations_public_id', CONSTRAINT_TYPE: 'UNIQUE' },
        { CONSTRAINT_NAME: 'uq_budget_allocations_identity', CONSTRAINT_TYPE: 'UNIQUE' },
        { CONSTRAINT_NAME: 'chk_budget_allocations_quarter', CONSTRAINT_TYPE: 'CHECK' },
        { CONSTRAINT_NAME: 'chk_budget_allocations_fiscal_year', CONSTRAINT_TYPE: 'CHECK' },
        { CONSTRAINT_NAME: 'chk_budget_allocations_status', CONSTRAINT_TYPE: 'CHECK' },
        { CONSTRAINT_NAME: 'chk_budget_allocations_deletion_metadata', CONSTRAINT_TYPE: 'CHECK' },
        { CONSTRAINT_NAME: 'fk_budget_allocations_office', CONSTRAINT_TYPE: 'FOREIGN KEY' },
        { CONSTRAINT_NAME: 'fk_budget_allocations_deleted_by', CONSTRAINT_TYPE: 'FOREIGN KEY' },
      ]),
    );

    const indexes = await sql<{ INDEX_NAME: string }>`
      select distinct INDEX_NAME
      from information_schema.statistics
      where table_schema = database() and table_name = 'budget_allocations'
    `.execute(database);
    expect(indexes.rows.map((row) => row.INDEX_NAME)).toEqual(
      expect.arrayContaining([
        'idx_budget_allocations_admin_order',
        'idx_budget_allocations_operational',
        'idx_budget_allocations_office',
      ]),
    );
  });

  it('seeds budget.read for exactly the accepted roles', async () => {
    const assignments = await database
      .selectFrom('role_permissions as rp')
      .innerJoin('roles as r', 'r.id', 'rp.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select('r.code as role')
      .where('p.code', '=', 'budget.read')
      .orderBy('r.code')
      .execute();

    expect(assignments.map((assignment) => assignment.role)).toEqual([
      'AUDITOR',
      'BUDGET_OFFICER',
      'PSMD_STAFF',
      'SUPER_ADMIN',
      'SYSTEM_ADMIN',
      'VIEWER',
    ]);
  });

  it('rolls back and reapplies only migration 000005 beneath later migrations', async () => {
    const migrator = createMigrator(database);
    await database.deleteFrom('budget_allocations').execute();
    await database.deleteFrom('offices').where('abbreviation', '=', 'MIGSAFE').execute();
    await database
      .insertInto('offices')
      .values({
        public_id: publicIdToBinary(PublicId.from('01900000-0000-7005-8000-000000000099')),
        office_name: 'Migration safety office',
        abbreviation: 'MIGSAFE',
        status: 'ACTIVE',
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason: null,
        created_at: new Date('2026-08-28T09:30:00.000Z'),
        updated_at: new Date('2026-08-28T09:30:00.000Z'),
      })
      .execute();
    const settingsRollback = await migrator.migrateDown();
    expect(settingsRollback.error).toBeUndefined();
    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();

    const tables = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('budget_allocations', 'offices')
      order by TABLE_NAME
    `.execute(database);
    expect(tables.rows.map((row) => row.TABLE_NAME)).toEqual(['offices']);
    const preservedOffice = await database
      .selectFrom('offices')
      .select('office_name')
      .where('abbreviation', '=', 'MIGSAFE')
      .executeTakeFirst();
    expect(preservedOffice?.office_name).toBe('Migration safety office');

    const permission = await database
      .selectFrom('permissions')
      .select('code')
      .where('code', '=', 'budget.read')
      .execute();
    expect(permission).toEqual([]);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    expect(
      await database
        .selectFrom('offices')
        .select('office_name')
        .where('abbreviation', '=', 'MIGSAFE')
        .executeTakeFirst(),
    ).toEqual({ office_name: 'Migration safety office' });
  });
});
