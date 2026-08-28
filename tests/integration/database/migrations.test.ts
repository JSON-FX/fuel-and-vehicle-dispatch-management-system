import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

import { createTestDatabase } from '../helpers/test-database';

interface ColumnDescription {
  readonly TABLE_SCHEMA?: string;
  readonly TABLE_NAME?: string;
  readonly COLUMN_NAME: string;
  readonly COLUMN_TYPE: string;
  readonly DATA_TYPE: string;
  readonly DATETIME_PRECISION: number | null;
}

let database: Kysely<Database>;

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  const result = await createMigrator(database).migrateToLatest();
  expect(result.error).toBeUndefined();
});

afterAll(async () => {
  await database.destroy();
});

describe('baseline migrations', () => {
  it('creates the expected identity, JSON, uniqueness, and timestamp schema', async () => {
    const result = await sql<ColumnDescription>`
      select COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database() and table_name = 'application_metadata'
      order by ORDINAL_POSITION
    `.execute(database);
    const columns = new Map(result.rows.map((column) => [column.COLUMN_NAME, column]));

    expect(columns.get('id')?.COLUMN_TYPE).toBe('bigint unsigned');
    expect(columns.get('public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(columns.get('metadata_value')?.DATA_TYPE).toBe('json');
    expect(columns.get('created_at')?.DATETIME_PRECISION).toBe(6);
    expect(columns.get('updated_at')?.DATETIME_PRECISION).toBe(6);

    const indexes = await sql<{ COLUMN_NAME: string; NON_UNIQUE: string }>`
      select COLUMN_NAME, NON_UNIQUE
      from information_schema.statistics
      where table_schema = database() and table_name = 'application_metadata'
    `.execute(database);
    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ COLUMN_NAME: 'public_id', NON_UNIQUE: '0' }),
        expect.objectContaining({ COLUMN_NAME: 'metadata_key', NON_UNIQUE: '0' }),
      ]),
    );
  });

  it('preserves internal BIGINT values above Number.MAX_SAFE_INTEGER as strings', async () => {
    await sql`alter table application_metadata auto_increment = 9007199254740993`.execute(database);
    const publicId = PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a');
    await database
      .insertInto('application_metadata')
      .values({
        public_id: publicIdToBinary(publicId),
        metadata_key: 'foundation.bigint',
        metadata_value: JSON.stringify({ validated: true }),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    const row = await database
      .selectFrom('application_metadata')
      .select('id')
      .where('metadata_key', '=', 'foundation.bigint')
      .executeTakeFirstOrThrow();
    expect(row.id).toBe('9007199254740993');
  });

  it('enforces public identifier uniqueness', async () => {
    const publicId = PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a');

    await expect(
      database
        .insertInto('application_metadata')
        .values({
          public_id: publicIdToBinary(publicId),
          metadata_key: 'foundation.duplicate',
          metadata_value: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute(),
    ).rejects.toThrow();
  });

  it('creates exact primary and sink audit table shapes', async () => {
    const result = await sql<ColumnDescription>`
      select TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, DATETIME_PRECISION
      from information_schema.columns
      where (TABLE_SCHEMA = 'fvdms_audit'
          and TABLE_NAME in (
            'audit_outbox',
            'audit_chain_entries',
            'audit_chain_heads',
            'audit_sink_deliveries',
            'audit_verification_runs'
          ))
         or (TABLE_SCHEMA = 'fvdms_audit_sink' and TABLE_NAME = 'audit_sink_entries')
    `.execute(database);
    const columns = new Map(
      result.rows.map((column) => [
        `${column.TABLE_SCHEMA}.${column.TABLE_NAME}.${column.COLUMN_NAME}`,
        column,
      ]),
    );

    expect(columns.get('fvdms_audit.audit_outbox.source_position')?.COLUMN_TYPE).toBe(
      'bigint unsigned',
    );
    expect(columns.get('fvdms_audit.audit_outbox.event_public_id')?.COLUMN_TYPE).toBe('binary(16)');
    expect(columns.get('fvdms_audit.audit_outbox.canonical_payload')?.DATA_TYPE).toBe('longtext');
    expect(columns.get('fvdms_audit.audit_chain_entries.previous_hash')?.COLUMN_TYPE).toBe(
      'binary(32)',
    );
    expect(columns.get('fvdms_audit.audit_chain_entries.record_hash')?.COLUMN_TYPE).toBe(
      'binary(32)',
    );
    expect(columns.get('fvdms_audit.audit_chain_entries.chained_at')?.DATETIME_PRECISION).toBe(6);
    expect(columns.get('fvdms_audit.audit_verification_runs.status')?.COLUMN_TYPE).toBe(
      'varchar(8)',
    );
    expect(
      columns.get('fvdms_audit_sink.audit_sink_entries.delivery_fingerprint')?.COLUMN_TYPE,
    ).toBe('binary(32)');

    const indexes = await sql<{
      TABLE_SCHEMA: string;
      TABLE_NAME: string;
      INDEX_NAME: string;
      NON_UNIQUE: string;
    }>`
      select TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, NON_UNIQUE
      from information_schema.statistics
      where TABLE_SCHEMA in ('fvdms_audit', 'fvdms_audit_sink')
    `.execute(database);

    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          TABLE_SCHEMA: 'fvdms_audit',
          TABLE_NAME: 'audit_chain_entries',
          INDEX_NAME: 'uq_audit_chain_source_position',
          NON_UNIQUE: '0',
        }),
        expect.objectContaining({
          TABLE_SCHEMA: 'fvdms_audit',
          TABLE_NAME: 'audit_chain_entries',
          INDEX_NAME: 'idx_audit_chain_action_sequence',
          NON_UNIQUE: '1',
        }),
        expect.objectContaining({
          TABLE_SCHEMA: 'fvdms_audit_sink',
          TABLE_NAME: 'audit_sink_entries',
          INDEX_NAME: 'idx_audit_sink_sequence',
          NON_UNIQUE: '1',
        }),
      ]),
    );
  });

  it('seeds the all-zero chain head', async () => {
    const result = await sql<{
      head_name: string;
      last_sequence: string;
      last_source_position: string;
      last_record_hash: Buffer;
    }>`
      select head_name, last_sequence, last_source_position, last_record_hash
      from fvdms_audit.audit_chain_heads
    `.execute(database);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.head_name).toBe('global');
    expect(result.rows[0]?.last_sequence).toBe('0');
    expect(result.rows[0]?.last_source_position).toBe('0');
    expect(result.rows[0]?.last_record_hash).toEqual(Buffer.alloc(32));
  });

  it('creates disabled global MFA settings with administration permission', async () => {
    const settings = await database
      .selectFrom('authentication_settings')
      .select(['mfa_required', 'updated_by_user_id'])
      .executeTakeFirstOrThrow();
    const assignments = await database
      .selectFrom('role_permissions')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .innerJoin('roles', 'roles.id', 'role_permissions.role_id')
      .select('roles.code')
      .where('permissions.code', '=', 'auth.settings.manage')
      .orderBy('roles.code')
      .execute();

    expect(settings).toEqual({ mfa_required: 0, updated_by_user_id: null });
    expect(assignments.map((assignment) => assignment.code)).toEqual([
      'SUPER_ADMIN',
      'SYSTEM_ADMIN',
    ]);
  });

  it('rolls back and reapplies only the latest fuel workflow migration', async () => {
    const migrator = createMigrator(database);
    expect(
      (await migrator.getMigrations()).filter((migration) => migration.executedAt),
    ).toHaveLength(7);

    const rollback = await migrator.migrateDown();
    expect(rollback.error).toBeUndefined();
    const afterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('application_metadata', 'users', 'auth_security_events')
    `.execute(database);
    expect(afterRollback.rows.map((row) => row.TABLE_NAME).sort()).toEqual([
      'application_metadata',
      'users',
    ]);

    const masterDataTablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in ('offices', 'drivers', 'vehicles')
    `.execute(database);
    expect(masterDataTablesAfterRollback.rows.map((row) => row.TABLE_NAME).sort()).toEqual([
      'drivers',
      'offices',
      'vehicles',
    ]);

    const latestTablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
        and table_name in (
          'budget_allocations',
          'authentication_settings',
          'fuel_sequence_monthly',
          'fuel_issuances',
          'fuel_ledger_entries'
        )
    `.execute(database);
    expect(latestTablesAfterRollback.rows.map((row) => row.TABLE_NAME).sort()).toEqual([
      'authentication_settings',
      'budget_allocations',
    ]);

    const auditTablesAfterRollback = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema in ('fvdms_audit', 'fvdms_audit_sink')
        and table_name like 'audit_%'
    `.execute(database);
    expect(auditTablesAfterRollback.rows.length).toBeGreaterThan(0);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();
    expect(
      (await migrator.getMigrations()).filter((migration) => migration.executedAt),
    ).toHaveLength(7);
  });
});
