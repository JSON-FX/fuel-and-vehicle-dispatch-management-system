import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-29T00:00:00.000Z');

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('export_jobs')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('requester_user_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('report_type', 'varchar(32)', (column) => column.notNull())
    .addColumn('period_type', 'varchar(10)', (column) => column.notNull())
    .addColumn('filters', 'json', (column) => column.notNull())
    .addColumn('filter_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('mode', 'varchar(12)', (column) => column.notNull())
    .addColumn('status', 'varchar(10)', (column) => column.notNull())
    .addColumn('estimated_rows', 'integer', (column) => column.unsigned().notNull())
    .addColumn('actual_rows', 'integer', (column) => column.unsigned())
    .addColumn('attempts', sql`tinyint unsigned`, (column) => column.notNull().defaultTo(0))
    .addColumn('max_attempts', sql`tinyint unsigned`, (column) => column.notNull().defaultTo(3))
    .addColumn('available_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('lease_owner', 'varchar(100)')
    .addColumn('lease_expires_at', 'datetime(6)')
    .addColumn('started_at', 'datetime(6)')
    .addColumn('finished_at', 'datetime(6)')
    .addColumn('storage_key', 'varchar(255)')
    .addColumn('filename', 'varchar(255)')
    .addColumn('mime_type', 'varchar(100)')
    .addColumn('byte_length', 'bigint', (column) => column.unsigned())
    .addColumn('sha256', 'binary(32)')
    .addColumn('file_expires_at', 'datetime(6)')
    .addColumn('failure_code', 'varchar(40)')
    .addColumn('failure_message', 'varchar(255)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_export_jobs_public_id', ['public_id'])
    .addCheckConstraint(
      'chk_export_jobs_report_type',
      sql`report_type in (
        'FUEL_ISSUANCE',
        'DISPATCH',
        'FUEL_BY_OFFICE',
        'FUEL_BY_VEHICLE',
        'FUEL_TYPE_TOTALS',
        'FUEL_AMOUNT_BY_PERIOD',
        'DISPATCH_COUNT_BY_OFFICE',
        'VEHICLE_UTILIZATION',
        'BUDGET_ALLOCATION_ACTIVITY'
      )`,
    )
    .addCheckConstraint(
      'chk_export_jobs_period_type',
      sql`period_type in ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM')`,
    )
    .addCheckConstraint('chk_export_jobs_mode', sql`mode in ('SYNCHRONOUS', 'QUEUED')`)
    .addCheckConstraint(
      'chk_export_jobs_status',
      sql`status in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED')`,
    )
    .addCheckConstraint(
      'chk_export_jobs_row_limits',
      sql`estimated_rows <= 100000 and (actual_rows is null or actual_rows <= 100000)`,
    )
    .addCheckConstraint(
      'chk_export_jobs_attempts',
      sql`max_attempts = 3 and attempts <= max_attempts`,
    )
    .addCheckConstraint(
      'chk_export_jobs_file_metadata',
      sql`(
        status = 'COMPLETED'
        and storage_key is not null
        and filename is not null
        and mime_type is not null
        and byte_length is not null
        and sha256 is not null
        and file_expires_at is not null
      ) or (
        status <> 'COMPLETED'
        and storage_key is null
        and filename is null
        and mime_type is null
        and byte_length is null
        and sha256 is null
        and file_expires_at is null
      )`,
    )
    .addForeignKeyConstraint(
      'fk_export_jobs_requester',
      ['requester_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_export_jobs_requester_created')
    .on('export_jobs')
    .columns(['requester_user_id', 'created_at'])
    .execute();
  await database.schema
    .createIndex('idx_export_jobs_queue')
    .on('export_jobs')
    .columns(['status', 'available_at', 'lease_expires_at', 'id'])
    .execute();
  await database.schema
    .createIndex('idx_export_jobs_file_expiry')
    .on('export_jobs')
    .columns(['status', 'file_expires_at'])
    .execute();

  await database.schema
    .createTable('export_download_tokens')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('export_job_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('user_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('token_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('expires_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('consumed_at', 'datetime(6)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_export_download_tokens_hash', ['token_hash'])
    .addForeignKeyConstraint(
      'fk_export_download_tokens_job',
      ['export_job_id'],
      'export_jobs',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_export_download_tokens_user',
      ['user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_export_download_tokens_job_user')
    .on('export_download_tokens')
    .columns(['export_job_id', 'user_id'])
    .execute();
  await database.schema
    .createIndex('idx_export_download_tokens_expiry')
    .on('export_download_tokens')
    .column('expires_at')
    .execute();

  const role = await database
    .selectFrom('roles')
    .select('id')
    .where('code', '=', 'DISPATCH_OFFICER')
    .executeTakeFirstOrThrow();
  const permission = await database
    .selectFrom('permissions')
    .select('id')
    .where('code', '=', 'report.export')
    .executeTakeFirstOrThrow();
  const existingGrant = await database
    .selectFrom('role_permissions')
    .select('id')
    .where('role_id', '=', role.id)
    .where('permission_id', '=', permission.id)
    .executeTakeFirst();

  if (existingGrant === undefined) {
    await database
      .insertInto('role_permissions')
      .values({
        role_id: role.id,
        permission_id: permission.id,
        assigned_by_user_id: null,
        created_at: seededAt,
      })
      .execute();
  }
}

export async function down(database: Kysely<Database>): Promise<void> {
  const role = await database
    .selectFrom('roles')
    .select('id')
    .where('code', '=', 'DISPATCH_OFFICER')
    .executeTakeFirst();
  const permission = await database
    .selectFrom('permissions')
    .select('id')
    .where('code', '=', 'report.export')
    .executeTakeFirst();

  if (role !== undefined && permission !== undefined) {
    await database
      .deleteFrom('role_permissions')
      .where('role_id', '=', role.id)
      .where('permission_id', '=', permission.id)
      .execute();
  }

  await database.schema.dropTable('export_download_tokens').execute();
  await database.schema.dropTable('export_jobs').execute();
}
