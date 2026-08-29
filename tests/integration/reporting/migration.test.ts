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

describe('reporting export migration', () => {
  it('creates durable export jobs with bounded row counts and private file metadata', async () => {
    const columns = await sql<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      COLUMN_DEFAULT: string | null;
      DATETIME_PRECISION: number | null;
    }>`
      select COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'export_jobs'
    `.execute(database);
    const byName = new Map(columns.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(byName.get('id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(byName.get('requester_user_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('report_type')?.COLUMN_TYPE).toBe('varchar(32)');
    expect(byName.get('period_type')?.COLUMN_TYPE).toBe('varchar(10)');
    expect(byName.get('filters')?.COLUMN_TYPE).toBe('json');
    expect(byName.get('filter_hash')?.COLUMN_TYPE).toBe('binary(32)');
    expect(byName.get('mode')?.COLUMN_TYPE).toBe('varchar(12)');
    expect(byName.get('status')?.COLUMN_TYPE).toBe('varchar(10)');
    expect(byName.get('estimated_rows')?.COLUMN_TYPE).toBe('int unsigned');
    expect(byName.get('attempts')).toMatchObject({
      COLUMN_TYPE: 'tinyint unsigned',
      COLUMN_DEFAULT: '0',
    });
    expect(byName.get('max_attempts')).toMatchObject({
      COLUMN_TYPE: 'tinyint unsigned',
      COLUMN_DEFAULT: '3',
    });
    expect(byName.get('lease_owner')?.IS_NULLABLE).toBe('YES');
    expect(byName.get('storage_key')?.IS_NULLABLE).toBe('YES');
    expect(byName.get('sha256')?.COLUMN_TYPE).toBe('binary(32)');
    expect(byName.get('created_at')?.DATETIME_PRECISION).toBe(6);
    expect(byName.get('updated_at')?.DATETIME_PRECISION).toBe(6);
  });

  it('adds exact queue, retention, state, and requester constraints', async () => {
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
      where tc.CONSTRAINT_SCHEMA = database() and tc.TABLE_NAME = 'export_jobs'
    `.execute(database);

    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_export_jobs_public_id' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_report_type' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_period_type' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_mode' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_status' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_row_limits' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_attempts' }),
        expect.objectContaining({ CONSTRAINT_NAME: 'chk_export_jobs_file_metadata' }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_export_jobs_requester',
          DELETE_RULE: 'RESTRICT',
        }),
      ]),
    );

    const indexes = await sql<{ INDEX_NAME: string }>`
      select distinct INDEX_NAME
      from information_schema.statistics
      where table_schema = database() and table_name = 'export_jobs'
    `.execute(database);
    expect(indexes.rows.map((row) => row.INDEX_NAME)).toEqual(
      expect.arrayContaining([
        'uq_export_jobs_public_id',
        'idx_export_jobs_requester_created',
        'idx_export_jobs_queue',
        'idx_export_jobs_file_expiry',
      ]),
    );
  });

  it('creates one-time download tokens with restrictive ownership references', async () => {
    const columns = await sql<{
      COLUMN_NAME: string;
      COLUMN_TYPE: string;
      IS_NULLABLE: 'YES' | 'NO';
      DATETIME_PRECISION: number | null;
    }>`
      select COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'export_download_tokens'
    `.execute(database);
    const byName = new Map(columns.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(byName.get('export_job_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('user_id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(byName.get('token_hash')?.COLUMN_TYPE).toBe('binary(32)');
    expect(byName.get('expires_at')?.DATETIME_PRECISION).toBe(6);
    expect(byName.get('consumed_at')?.IS_NULLABLE).toBe('YES');

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
        and tc.TABLE_NAME = 'export_download_tokens'
    `.execute(database);
    expect(constraints.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ CONSTRAINT_NAME: 'uq_export_download_tokens_hash' }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_export_download_tokens_job',
          DELETE_RULE: 'RESTRICT',
        }),
        expect.objectContaining({
          CONSTRAINT_NAME: 'fk_export_download_tokens_user',
          DELETE_RULE: 'RESTRICT',
        }),
      ]),
    );

    const indexes = await sql<{ INDEX_NAME: string }>`
      select distinct INDEX_NAME
      from information_schema.statistics
      where table_schema = database() and table_name = 'export_download_tokens'
    `.execute(database);
    expect(indexes.rows.map((row) => row.INDEX_NAME)).toEqual(
      expect.arrayContaining([
        'uq_export_download_tokens_hash',
        'idx_export_download_tokens_job_user',
        'idx_export_download_tokens_expiry',
      ]),
    );
  });

  it('grants report exports to dispatch officers', async () => {
    await expect(
      database
        .selectFrom('role_permissions as rp')
        .innerJoin('roles as r', 'r.id', 'rp.role_id')
        .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
        .select(['r.code as roleCode', 'p.code as permissionCode'])
        .where('r.code', '=', 'DISPATCH_OFFICER')
        .where('p.code', '=', 'report.export')
        .executeTakeFirst(),
    ).resolves.toEqual({ roleCode: 'DISPATCH_OFFICER', permissionCode: 'report.export' });
  });

  it('rolls migration 000010 down and reapplies it without disturbing prior features', async () => {
    const migrator = createMigrator(database);
    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();

    const tablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in (
          'export_jobs',
          'export_download_tokens',
          'dispatch_schedule_settings',
          'vehicle_dispatch_conflict_overrides'
        )
      order by TABLE_NAME
    `.execute(database);
    expect(tablesAfterRollback.rows.map((row) => row.TABLE_NAME)).toEqual([
      'dispatch_schedule_settings',
      'vehicle_dispatch_conflict_overrides',
    ]);

    const grantAfterRollback = await database
      .selectFrom('role_permissions as rp')
      .innerJoin('roles as r', 'r.id', 'rp.role_id')
      .innerJoin('permissions as p', 'p.id', 'rp.permission_id')
      .select('rp.id')
      .where('r.code', '=', 'DISPATCH_OFFICER')
      .where('p.code', '=', 'report.export')
      .executeTakeFirst();
    expect(grantAfterRollback).toBeUndefined();

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    const exportTables = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('export_jobs', 'export_download_tokens')
      order by TABLE_NAME
    `.execute(database);
    expect(exportTables.rows.map((row) => row.TABLE_NAME)).toEqual([
      'export_download_tokens',
      'export_jobs',
    ]);
  });
});
