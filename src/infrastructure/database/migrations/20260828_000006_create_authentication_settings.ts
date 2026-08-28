import { parse as parseUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-28T00:00:00.000Z');
const permission = {
  publicId: '019d0000-0000-7006-8000-000000000001',
  code: 'auth.settings.manage',
  name: 'Manage authentication settings',
} as const;
const assignedRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN'] as const;

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('authentication_settings')
    .addColumn('id', sql`tinyint unsigned`, (column) => column.primaryKey())
    .addColumn('mfa_required', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('updated_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_authentication_settings_singleton', sql`id = 1`)
    .execute();

  await database
    .insertInto('authentication_settings')
    .values({ id: 1, mfa_required: false, updated_by_user_id: null, updated_at: seededAt })
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
          throw new Error(`Authentication settings role ${roleCode} is unavailable.`);
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

  await database.schema.dropTable('authentication_settings').execute();
}
