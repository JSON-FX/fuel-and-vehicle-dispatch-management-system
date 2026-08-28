import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

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

describe('dispatch workflow migration', () => {
  it('creates the normalized dispatch table with exact dates, decimals, and lifecycle fields', async () => {
    const columns = await sql<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      COLUMN_DEFAULT: string | null;
      DATETIME_PRECISION: number | null;
    }>`
      select COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'vehicle_dispatches'
    `.execute(database);
    const byName = new Map(columns.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(byName.get('id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(byName.get('driver_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('vehicle_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('requesting_office_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('entry_date')?.COLUMN_TYPE).toBe('date');
    expect(byName.get('travel_date')?.COLUMN_TYPE).toBe('date');
    expect(byName.get('travel_start_at')).toMatchObject({ IS_NULLABLE: 'YES' });
    expect(byName.get('travel_end_at')).toMatchObject({ IS_NULLABLE: 'YES' });
    expect(byName.get('destination')?.COLUMN_TYPE).toBe('varchar(255)');
    expect(byName.get('purpose')?.COLUMN_TYPE).toBe('varchar(500)');
    expect(byName.get('odo_before')?.COLUMN_TYPE).toBe('decimal(12,1)');
    expect(byName.get('odo_after')).toMatchObject({
      COLUMN_TYPE: 'decimal(12,1)',
      IS_NULLABLE: 'YES',
    });
    expect(byName.get('passenger_count')?.COLUMN_TYPE).toBe('int unsigned');
    expect(byName.get('status')?.COLUMN_TYPE).toBe('varchar(10)');
    expect(byName.get('created_at')?.DATETIME_PRECISION).toBe(6);
    expect(byName.get('updated_at')?.DATETIME_PRECISION).toBe(6);
  });

  it('adds named uniqueness, lifecycle, odometer, and restrictive reference constraints', async () => {
    const constraints = await sql<{
      CONSTRAINT_NAME: string;
      CONSTRAINT_TYPE: string;
      DELETE_RULE: string | null;
    }>`
      select tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE, rc.DELETE_RULE
      from information_schema.table_constraints tc
      left join information_schema.referential_constraints rc
        on rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        and rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      where tc.CONSTRAINT_SCHEMA = database() and tc.TABLE_NAME = 'vehicle_dispatches'
    `.execute(database);

    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_vehicle_dispatches_public_id' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_vehicle_dispatches_status' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_vehicle_dispatches_odo_nonnegative' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_vehicle_dispatches_odo_order' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_vehicle_dispatches_lifecycle' }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_vehicle_dispatches_driver',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_vehicle_dispatches_vehicle',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_vehicle_dispatches_office',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_vehicle_dispatches_created_by',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_vehicle_dispatches_cancelled_by',
          DELETE_RULE: 'RESTRICT',
        }),
      ]),
    );
  });

  it('adds list and future schedule-supporting indexes without conflict persistence', async () => {
    const indexes = await sql<{ INDEX_NAME: string }>`
      select distinct INDEX_NAME
      from information_schema.statistics
      where table_schema = database() and table_name = 'vehicle_dispatches'
    `.execute(database);
    expect(indexes.rows.map((row) => row.INDEX_NAME)).toEqual(
      expect.arrayContaining([
        'idx_vehicle_dispatches_travel',
        'idx_vehicle_dispatches_office_travel',
        'idx_vehicle_dispatches_vehicle_schedule',
        'idx_vehicle_dispatches_driver_schedule',
      ]),
    );

    const conflictTables = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database() and table_name like 'vehicle_dispatch_conflict%'
    `.execute(database);
    expect(conflictTables.rows).toEqual([]);
  });

  it('rolls migration 000008 down and reapplies it without disturbing earlier workflows', async () => {
    const migrator = createMigrator(database);
    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();
    const tablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('vehicle_dispatches', 'fuel_issuances', 'budget_allocations')
      order by TABLE_NAME
    `.execute(database);
    expect(tablesAfterRollback.rows.map((row) => row.TABLE_NAME)).toEqual([
      'budget_allocations',
      'fuel_issuances',
    ]);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    const dispatchTable = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database() and table_name = 'vehicle_dispatches'
    `.execute(database);
    expect(dispatchTable.rows).toEqual([{ TABLE_NAME: 'vehicle_dispatches' }]);
  });
});
