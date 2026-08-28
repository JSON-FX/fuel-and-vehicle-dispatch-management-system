import { parse as parseUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-29T00:00:00.000Z');
const permissions = [
  {
    publicId: '019d0000-0000-7009-8000-000000000001',
    code: 'dispatch.conflict.override',
    name: 'Override dispatch schedule conflicts',
    roles: ['DISPATCH_OFFICER', 'SUPER_ADMIN'],
  },
  {
    publicId: '019d0000-0000-7009-8000-000000000002',
    code: 'dispatch.settings.manage',
    name: 'Manage dispatch schedule settings',
    roles: ['SYSTEM_ADMIN', 'SUPER_ADMIN'],
  },
] as const;

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('dispatch_schedule_settings')
    .addColumn('id', sql`tinyint unsigned`, (column) => column.primaryKey())
    .addColumn('policy', 'varchar(12)', (column) => column.notNull().defaultTo('WARN_AND_ACK'))
    .addColumn('updated_by_user_id', 'bigint', (column) => column.unsigned())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_dispatch_schedule_settings_singleton', sql`id = 1`)
    .addCheckConstraint(
      'chk_dispatch_schedule_settings_policy',
      sql`policy in ('BLOCK', 'WARN_AND_ACK')`,
    )
    .addForeignKeyConstraint(
      'fk_dispatch_schedule_settings_updated_by',
      ['updated_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database
    .insertInto('dispatch_schedule_settings')
    .values({
      id: 1,
      policy: 'WARN_AND_ACK',
      updated_by_user_id: null,
      updated_at: seededAt,
    })
    .execute();

  await database.schema
    .createTable('vehicle_dispatch_conflict_overrides')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull())
    .addColumn('dispatch_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('conflicting_dispatch_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('conflict_type', 'varchar(18)', (column) => column.notNull())
    .addColumn('policy', 'varchar(12)', (column) => column.notNull())
    .addColumn('acknowledged_by_user_id', 'bigint', (column) => column.unsigned().notNull())
    .addColumn('acknowledgement_reason', 'varchar(500)', (column) => column.notNull())
    .addColumn('acknowledged_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_dispatch_conflict_overrides_public_id', ['public_id'])
    .addCheckConstraint(
      'chk_dispatch_conflict_overrides_type',
      sql`conflict_type in ('DRIVER', 'VEHICLE', 'DRIVER_AND_VEHICLE')`,
    )
    .addCheckConstraint(
      'chk_dispatch_conflict_overrides_policy',
      sql`policy in ('BLOCK', 'WARN_AND_ACK')`,
    )
    .addCheckConstraint(
      'chk_dispatch_conflict_overrides_reason',
      sql`char_length(acknowledgement_reason) between 10 and 500`,
    )
    .addCheckConstraint(
      'chk_dispatch_conflict_overrides_distinct_dispatches',
      sql`dispatch_id <> conflicting_dispatch_id`,
    )
    .addForeignKeyConstraint(
      'fk_dispatch_conflict_overrides_dispatch',
      ['dispatch_id'],
      'vehicle_dispatches',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_dispatch_conflict_overrides_conflicting',
      ['conflicting_dispatch_id'],
      'vehicle_dispatches',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .addForeignKeyConstraint(
      'fk_dispatch_conflict_overrides_actor',
      ['acknowledged_by_user_id'],
      'users',
      ['id'],
      (constraint) => constraint.onDelete('restrict'),
    )
    .execute();

  await database.schema
    .createIndex('idx_dispatch_conflict_overrides_dispatch')
    .on('vehicle_dispatch_conflict_overrides')
    .column('dispatch_id')
    .execute();
  await database.schema
    .createIndex('idx_dispatch_conflict_overrides_conflicting')
    .on('vehicle_dispatch_conflict_overrides')
    .column('conflicting_dispatch_id')
    .execute();
  await database.schema
    .createIndex('idx_dispatch_conflict_overrides_actor_time')
    .on('vehicle_dispatch_conflict_overrides')
    .columns(['acknowledged_by_user_id', 'acknowledged_at'])
    .execute();

  await database
    .insertInto('permissions')
    .values(
      permissions.map((permission) => ({
        public_id: Buffer.from(parseUuid(permission.publicId)),
        code: permission.code,
        name: permission.name,
        is_active: true,
        is_system: true,
        created_at: seededAt,
        updated_at: seededAt,
      })),
    )
    .execute();

  const permissionRows = await database
    .selectFrom('permissions')
    .select(['id', 'code'])
    .where(
      'code',
      'in',
      permissions.map((permission) => permission.code),
    )
    .execute();
  const roleRows = await database
    .selectFrom('roles')
    .select(['id', 'code'])
    .where('code', 'in', ['DISPATCH_OFFICER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'])
    .execute();
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleIds = new Map(roleRows.map((row) => [row.code, row.id]));

  await database
    .insertInto('role_permissions')
    .values(
      permissions.flatMap((permission) =>
        permission.roles.map((roleCode) => {
          const permissionId = permissionIds.get(permission.code);
          const roleId = roleIds.get(roleCode);
          if (permissionId === undefined || roleId === undefined) {
            throw new Error(
              `Dispatch scheduling grant ${permission.code}:${roleCode} is unavailable.`,
            );
          }
          return {
            role_id: roleId,
            permission_id: permissionId,
            assigned_by_user_id: null,
            created_at: seededAt,
          };
        }),
      ),
    )
    .execute();
}

export async function down(database: Kysely<Database>): Promise<void> {
  const permissionRows = await database
    .selectFrom('permissions')
    .select('id')
    .where(
      'code',
      'in',
      permissions.map((permission) => permission.code),
    )
    .execute();
  const permissionIds = permissionRows.map((row) => row.id);

  if (permissionIds.length > 0) {
    await database
      .deleteFrom('role_permissions')
      .where('permission_id', 'in', permissionIds)
      .execute();
    await database.deleteFrom('permissions').where('id', 'in', permissionIds).execute();
  }

  await database.schema.dropTable('vehicle_dispatch_conflict_overrides').execute();
  await database.schema.dropTable('dispatch_schedule_settings').execute();
}
