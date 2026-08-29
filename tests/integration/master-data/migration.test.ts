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

describe('master-data migration', () => {
  it('creates normalized tables, named constraints, and soft-delete metadata', async () => {
    const columns = await sql<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      DATETIME_PRECISION: number | null;
    }>`
      select TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles')
    `.execute(database);
    const byName = new Map(
      columns.rows.map((column) => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column]),
    );

    expect(byName.get('offices.id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('drivers.public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(byName.get('vehicles.remarks')?.COLUMN_TYPE).toBe('text');
    expect(byName.get('offices.deleted_at')?.DATETIME_PRECISION).toBe(6);

    const indexes = await sql<{ TABLE_NAME: string; INDEX_NAME: string; NON_UNIQUE: string }>`
      select TABLE_NAME, INDEX_NAME, NON_UNIQUE
      from information_schema.statistics
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles')
    `.execute(database);
    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          TABLE_NAME: 'offices',
          INDEX_NAME: 'uq_offices_office_name',
          NON_UNIQUE: '0',
        }),
        expect.objectContaining({
          TABLE_NAME: 'offices',
          INDEX_NAME: 'uq_offices_abbreviation',
          NON_UNIQUE: '0',
        }),
        expect.objectContaining({
          TABLE_NAME: 'vehicles',
          INDEX_NAME: 'uq_vehicles_plate_no',
          NON_UNIQUE: '0',
        }),
      ]),
    );

    const checks = await sql<{ CONSTRAINT_NAME: string }>`
      select CONSTRAINT_NAME
      from information_schema.table_constraints
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles')
        and constraint_type = 'CHECK'
    `.execute(database);
    expect(checks.rows.map((row) => row.CONSTRAINT_NAME)).toEqual(
      expect.arrayContaining([
        'chk_offices_status',
        'chk_offices_deletion_metadata',
        'chk_drivers_status',
        'chk_drivers_deletion_metadata',
        'chk_vehicles_status',
        'chk_vehicles_deletion_metadata',
      ]),
    );
  });

  it('seeds the accepted read-permission matrix', async () => {
    const rows = await database
      .selectFrom('role_permissions as rp')
      .innerJoin('roles as r', 'r.id', 'rp.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select(['r.code as role', 'p.code as permission'])
      .where('p.code', 'in', ['office.read', 'driver.read', 'vehicle.read'])
      .execute();

    const assignments = rows.map((row) => `${row.role}:${row.permission}`);
    expect(assignments).toHaveLength(17);
    expect(assignments).toEqual(
      expect.arrayContaining([
        'BUDGET_OFFICER:office.read',
        'PSMD_STAFF:driver.read',
        'DISPATCH_OFFICER:vehicle.read',
        'VIEWER:office.read',
        'AUDITOR:vehicle.read',
      ]),
    );
  });

  it('preserves migration 000004 when rolling back 000005, then reapplies both', async () => {
    const migrator = createMigrator(database);
    const reportingRollback = await migrator.migrateDown();
    expect(reportingRollback.error).toBeUndefined();
    const schedulingRollback = await migrator.migrateDown();
    expect(schedulingRollback.error).toBeUndefined();
    const dispatchRollback = await migrator.migrateDown();
    expect(dispatchRollback.error).toBeUndefined();
    const fuelRollback = await migrator.migrateDown();
    expect(fuelRollback.error).toBeUndefined();
    const settingsRollback = await migrator.migrateDown();
    expect(settingsRollback.error).toBeUndefined();
    const budgetRollback = await migrator.migrateDown();
    expect(budgetRollback.error).toBeUndefined();

    const afterBudgetRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles', 'budget_allocations')
      order by TABLE_NAME
    `.execute(database);
    expect(afterBudgetRollback.rows.map((row) => row.TABLE_NAME)).toEqual([
      'drivers',
      'offices',
      'vehicles',
    ]);

    const masterDataRollback = await migrator.migrateDown();
    expect(masterDataRollback.error).toBeUndefined();

    const afterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles')
    `.execute(database);
    expect(afterRollback.rows).toEqual([]);

    const permissions = await database
      .selectFrom('permissions')
      .select('code')
      .where('code', 'in', ['office.read', 'driver.read', 'vehicle.read'])
      .execute();
    expect(permissions).toEqual([]);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
  });
});
