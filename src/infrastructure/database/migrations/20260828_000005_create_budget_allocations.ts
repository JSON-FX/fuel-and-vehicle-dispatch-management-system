import { parse as parseUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-28T09:30:00.000Z');
const permission = {
  publicId: '019d0000-0000-7005-8000-000000000001',
  code: 'budget.read',
  name: 'Read budget allocations',
} as const;
const assignedRoles = [
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'BUDGET_OFFICER',
  'PSMD_STAFF',
  'VIEWER',
  'AUDITOR',
] as const;

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('budget_allocations')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('ppmp_number', 'varchar(80)', (column) => column.notNull())
    .addColumn('office_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('quarter', sql`tinyint unsigned`, (column) => column.notNull())
    .addColumn('fiscal_year', 'smallint', (column) => column.unsigned().notNull())
    .addColumn('status', 'varchar(9)', (column) => column.notNull().defaultTo('DRAFT'))
    .addColumn('deleted_at', 'datetime(6)')
    .addColumn('deleted_by_user_id', 'bigint', (column) => column.unsigned())
    .addColumn('delete_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_budget_allocations_public_id', ['public_id'])
    .addUniqueConstraint('uq_budget_allocations_identity', [
      'ppmp_number',
      'office_id',
      'quarter',
      'fiscal_year',
    ])
    .addCheckConstraint('chk_budget_allocations_quarter', sql`quarter between 1 and 4`)
    .addCheckConstraint(
      'chk_budget_allocations_fiscal_year',
      sql`fiscal_year between 2000 and 9999`,
    )
    .addCheckConstraint(
      'chk_budget_allocations_status',
      sql`status in ('DRAFT', 'ACTIVE', 'CLOSED', 'CANCELLED')`,
    )
    .addCheckConstraint(
      'chk_budget_allocations_deletion_metadata',
      sql`(deleted_at is null and deleted_by_user_id is null and delete_reason is null)
        or (deleted_at is not null and deleted_by_user_id is not null and delete_reason is not null)`,
    )
    .addForeignKeyConstraint(
      'fk_budget_allocations_office',
      ['office_id'],
      'offices',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_budget_allocations_deleted_by',
      ['deleted_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_budget_allocations_admin_order')
    .on('budget_allocations')
    .columns(['deleted_at', 'fiscal_year', 'quarter', 'ppmp_number', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_budget_allocations_operational')
    .on('budget_allocations')
    .columns(['deleted_at', 'status', 'fiscal_year', 'quarter', 'office_id', 'ppmp_number'])
    .execute();
  await database.schema
    .createIndex('idx_budget_allocations_office')
    .on('budget_allocations')
    .columns(['office_id', 'deleted_at', 'status'])
    .execute();

  await database
    .insertInto('permissions')
    .values({
      public_id: Buffer.from(parseUuid(permission.publicId)),
      code: permission.code,
      name: permission.name,
      is_active: true,
      is_system: true,
      created_at: seededAt,
      updated_at: seededAt,
    })
    .execute();

  const permissionRow = await database
    .selectFrom('permissions')
    .select('id')
    .where('code', '=', permission.code)
    .executeTakeFirstOrThrow();
  const roleRows = await database
    .selectFrom('roles')
    .select(['id', 'code'])
    .where('code', 'in', assignedRoles)
    .execute();
  const roleIds = new Map(roleRows.map((role) => [role.code, role.id]));

  await database
    .insertInto('role_permissions')
    .values(
      assignedRoles.map((roleCode) => {
        const roleId = roleIds.get(roleCode);
        if (roleId === undefined) {
          throw new Error(`Budget read permission role ${roleCode} is unavailable.`);
        }
        return {
          role_id: roleId,
          permission_id: permissionRow.id,
          assigned_by_user_id: null,
          created_at: seededAt,
        };
      }),
    )
    .execute();
}

export async function down(database: Kysely<Database>): Promise<void> {
  const permissionRow = await database
    .selectFrom('permissions')
    .select('id')
    .where('code', '=', permission.code)
    .executeTakeFirst();

  if (permissionRow !== undefined) {
    await database
      .deleteFrom('role_permissions')
      .where('permission_id', '=', permissionRow.id)
      .execute();
    await database.deleteFrom('permissions').where('id', '=', permissionRow.id).execute();
  }

  await database.schema.dropTable('budget_allocations').execute();
}
