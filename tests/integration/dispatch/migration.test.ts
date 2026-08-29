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

  it('keeps dispatch schedule indexes without adding override columns to dispatches', async () => {
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

    const conflictColumns = await sql<{ COLUMN_NAME: string }>`
      select COLUMN_NAME
      from information_schema.columns
      where table_schema = database()
        and table_name = 'vehicle_dispatches'
        and column_name like 'conflict_override%'
    `.execute(database);
    expect(conflictColumns.rows).toEqual([]);
  });

  it('creates global schedule settings and append-only conflict override evidence', async () => {
    const settingsColumns = await sql<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      DATETIME_PRECISION: number | null;
    }>`
      select COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database()
        and table_name = 'dispatch_schedule_settings'
    `.execute(database);
    const settingsByName = new Map(
      settingsColumns.rows.map((column) => [column.COLUMN_NAME, column]),
    );

    expect(settingsByName.get('id')?.COLUMN_TYPE).toBe('tinyint unsigned');
    expect(settingsByName.get('policy')?.COLUMN_TYPE).toBe('varchar(12)');
    expect(settingsByName.get('updated_by_user_id')?.IS_NULLABLE).toBe('YES');
    expect(settingsByName.get('updated_at')?.DATETIME_PRECISION).toBe(6);
    await expect(
      database.selectFrom('dispatch_schedule_settings').selectAll().executeTakeFirstOrThrow(),
    ).resolves.toMatchObject({
      id: 1,
      policy: 'WARN_AND_ACK',
    });

    const overrideColumns = await sql<{ COLUMN_NAME: string; COLUMN_TYPE: string }>`
      select COLUMN_NAME, COLUMN_TYPE
      from information_schema.columns
      where table_schema = database()
        and table_name = 'vehicle_dispatch_conflict_overrides'
    `.execute(database);
    const overrideByName = new Map(
      overrideColumns.rows.map((column) => [column.COLUMN_NAME, column]),
    );

    expect(overrideByName.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(overrideByName.get('conflict_type')?.COLUMN_TYPE).toBe('varchar(18)');
    expect(overrideByName.get('policy')?.COLUMN_TYPE).toBe('varchar(12)');
    expect(overrideByName.get('acknowledgement_reason')?.COLUMN_TYPE).toBe('varchar(500)');
  });

  it('adds restrictive constraints, indexes, permissions, and accepted role grants', async () => {
    const constraints = await sql<{
      CONSTRAINT_NAME: string;
      DELETE_RULE: string | null;
    }>`
      select tc.CONSTRAINT_NAME, rc.DELETE_RULE
      from information_schema.table_constraints tc
      left join information_schema.referential_constraints rc
        on rc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
        and rc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
      where tc.CONSTRAINT_SCHEMA = database()
        and tc.TABLE_NAME in ('dispatch_schedule_settings', 'vehicle_dispatch_conflict_overrides')
    `.execute(database);
    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_dispatch_schedule_settings_singleton' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_dispatch_schedule_settings_policy' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_dispatch_conflict_overrides_type' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_dispatch_conflict_overrides_policy' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_dispatch_conflict_overrides_reason' }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_dispatch_conflict_overrides_dispatch',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_dispatch_conflict_overrides_conflicting',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_dispatch_conflict_overrides_actor',
          DELETE_RULE: 'RESTRICT',
        }),
      ]),
    );

    const indexes = await sql<{ INDEX_NAME: string }>`
      select distinct INDEX_NAME
      from information_schema.statistics
      where table_schema = database()
        and table_name = 'vehicle_dispatch_conflict_overrides'
    `.execute(database);
    expect(indexes.rows.map((row) => row.INDEX_NAME)).toEqual(
      expect.arrayContaining([
        'uq_dispatch_conflict_overrides_public_id',
        'idx_dispatch_conflict_overrides_dispatch',
        'idx_dispatch_conflict_overrides_conflicting',
        'idx_dispatch_conflict_overrides_actor_time',
      ]),
    );

    const grants = await database
      .selectFrom('role_permissions as rp')
      .innerJoin('roles as r', 'r.id', 'rp.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select(['p.code as permissionCode', 'r.code as roleCode'])
      .where('p.code', 'in', ['dispatch.conflict.override', 'dispatch.settings.manage'])
      .orderBy('p.code')
      .orderBy('r.code')
      .execute();
    expect(grants).toEqual([
      { permissionCode: 'dispatch.conflict.override', roleCode: 'DISPATCH_OFFICER' },
      { permissionCode: 'dispatch.conflict.override', roleCode: 'SUPER_ADMIN' },
      { permissionCode: 'dispatch.settings.manage', roleCode: 'SUPER_ADMIN' },
      { permissionCode: 'dispatch.settings.manage', roleCode: 'SYSTEM_ADMIN' },
    ]);
  });

  it('rolls migration 000009 down and reapplies it without disturbing dispatch workflow', async () => {
    const migrator = createMigrator(database);
    const reportingRollback = await migrator.migrateDown();
    expect(reportingRollback.error).toBeUndefined();
    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();
    const tablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in (
          'vehicle_dispatches',
          'dispatch_schedule_settings',
          'vehicle_dispatch_conflict_overrides'
        )
      order by TABLE_NAME
    `.execute(database);
    expect(tablesAfterRollback.rows.map((row) => row.TABLE_NAME)).toEqual(['vehicle_dispatches']);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    const scheduleTables = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('dispatch_schedule_settings', 'vehicle_dispatch_conflict_overrides')
      order by TABLE_NAME
    `.execute(database);
    expect(scheduleTables.rows.map((row) => row.TABLE_NAME)).toEqual([
      'dispatch_schedule_settings',
      'vehicle_dispatch_conflict_overrides',
    ]);
  });
});
