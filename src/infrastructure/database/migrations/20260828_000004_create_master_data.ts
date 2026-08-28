import { parse as parseUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-28T00:20:00.000Z');

const readPermissions = [
  {
    publicId: '019d0000-0000-7004-8000-000000000001',
    code: 'office.read',
    name: 'Read offices',
  },
  {
    publicId: '019d0000-0000-7004-8000-000000000002',
    code: 'driver.read',
    name: 'Read drivers',
  },
  {
    publicId: '019d0000-0000-7004-8000-000000000003',
    code: 'vehicle.read',
    name: 'Read vehicles',
  },
] as const;

const assignments = {
  'office.read': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'BUDGET_OFFICER', 'VIEWER', 'AUDITOR'],
  'driver.read': [
    'SUPER_ADMIN',
    'SYSTEM_ADMIN',
    'PSMD_STAFF',
    'DISPATCH_OFFICER',
    'VIEWER',
    'AUDITOR',
  ],
  'vehicle.read': [
    'SUPER_ADMIN',
    'SYSTEM_ADMIN',
    'PSMD_STAFF',
    'DISPATCH_OFFICER',
    'VIEWER',
    'AUDITOR',
  ],
} as const;

export async function up(database: Kysely<Database>): Promise<void> {
  await createOffices(database);
  await createDrivers(database);
  await createVehicles(database);
  await seedPermissions(database);
}

async function createOffices(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('offices')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('office_name', 'varchar(150)', (column) => column.notNull())
    .addColumn('abbreviation', 'varchar(30)', (column) => column.notNull())
    .addColumn('status', 'varchar(8)', (column) => column.notNull().defaultTo('ACTIVE'))
    .addColumn('deleted_at', 'datetime(6)')
    .addColumn('deleted_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('delete_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_offices_office_name', ['office_name'])
    .addUniqueConstraint('uq_offices_abbreviation', ['abbreviation'])
    .addCheckConstraint('chk_offices_status', sql`status in ('ACTIVE', 'INACTIVE')`)
    .addCheckConstraint(
      'chk_offices_deletion_metadata',
      sql`(deleted_at is null and deleted_by_user_id is null and delete_reason is null)
        or (deleted_at is not null and deleted_by_user_id is not null and delete_reason is not null)`,
    )
    .execute();

  await database.schema
    .createIndex('idx_offices_lifecycle_status_name')
    .on('offices')
    .columns(['deleted_at', 'status', 'office_name', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_offices_abbreviation_public_id')
    .on('offices')
    .columns(['abbreviation', 'public_id'])
    .execute();
}

async function createDrivers(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('drivers')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('full_name', 'varchar(150)', (column) => column.notNull())
    .addColumn('contact_no', 'varchar(50)')
    .addColumn('status', 'varchar(8)', (column) => column.notNull().defaultTo('ACTIVE'))
    .addColumn('deleted_at', 'datetime(6)')
    .addColumn('deleted_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('delete_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint('chk_drivers_status', sql`status in ('ACTIVE', 'INACTIVE')`)
    .addCheckConstraint(
      'chk_drivers_deletion_metadata',
      sql`(deleted_at is null and deleted_by_user_id is null and delete_reason is null)
        or (deleted_at is not null and deleted_by_user_id is not null and delete_reason is not null)`,
    )
    .execute();

  await database.schema
    .createIndex('idx_drivers_lifecycle_status_name')
    .on('drivers')
    .columns(['deleted_at', 'status', 'full_name', 'public_id'])
    .execute();
}

async function createVehicles(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('vehicles')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('model_brand', 'varchar(150)', (column) => column.notNull())
    .addColumn('vehicle_type', 'varchar(100)', (column) => column.notNull())
    .addColumn('plate_no', 'varchar(30)', (column) => column.notNull())
    .addColumn('status', 'varchar(16)', (column) => column.notNull().defaultTo('SERVICEABLE'))
    .addColumn('remarks', sql`text`)
    .addColumn('deleted_at', 'datetime(6)')
    .addColumn('deleted_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('delete_reason', 'varchar(500)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_vehicles_plate_no', ['plate_no'])
    .addCheckConstraint('chk_vehicles_status', sql`status in ('SERVICEABLE', 'UNSERVICEABLE')`)
    .addCheckConstraint(
      'chk_vehicles_deletion_metadata',
      sql`(deleted_at is null and deleted_by_user_id is null and delete_reason is null)
        or (deleted_at is not null and deleted_by_user_id is not null and delete_reason is not null)`,
    )
    .execute();

  await database.schema
    .createIndex('idx_vehicles_lifecycle_status_plate')
    .on('vehicles')
    .columns(['deleted_at', 'status', 'plate_no', 'public_id'])
    .execute();
  await database.schema
    .createIndex('idx_vehicles_model_brand_public_id')
    .on('vehicles')
    .columns(['model_brand', 'public_id'])
    .execute();
}

async function seedPermissions(database: Kysely<Database>): Promise<void> {
  await database
    .insertInto('permissions')
    .values(
      readPermissions.map((permission) => ({
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
      readPermissions.map((permission) => permission.code),
    )
    .execute();
  const roleCodes = [...new Set(Object.values(assignments).flat())];
  const roleRows = await database
    .selectFrom('roles')
    .select(['id', 'code'])
    .where('code', 'in', roleCodes)
    .execute();
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleIds = new Map(roleRows.map((row) => [row.code, row.id]));

  await database
    .insertInto('role_permissions')
    .values(
      Object.entries(assignments).flatMap(([permissionCode, assignedRoles]) =>
        assignedRoles.map((roleCode) => {
          const permissionId = permissionIds.get(permissionCode);
          const roleId = roleIds.get(roleCode);
          if (permissionId === undefined || roleId === undefined) {
            throw new Error(
              `Master-data permission assignment ${roleCode}/${permissionCode} is unavailable.`,
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
  const codes = readPermissions.map((permission) => permission.code);
  const permissionRows = await database
    .selectFrom('permissions')
    .select('id')
    .where('code', 'in', codes)
    .execute();
  const permissionIds = permissionRows.map((row) => row.id);

  if (permissionIds.length > 0) {
    await database
      .deleteFrom('role_permissions')
      .where('permission_id', 'in', permissionIds)
      .execute();
    await database.deleteFrom('permissions').where('id', 'in', permissionIds).execute();
  }

  await database.schema.dropTable('vehicles').execute();
  await database.schema.dropTable('drivers').execute();
  await database.schema.dropTable('offices').execute();
}
