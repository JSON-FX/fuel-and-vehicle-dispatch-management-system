import { parse as parseUuid } from 'uuid';

import { sql, type Kysely } from 'kysely';

import type { Database } from '@/infrastructure/database/types';

const seededAt = new Date('2026-08-28T00:00:00.000Z');

const roles = [
  ['SUPER_ADMIN', 'Super administrator', true],
  ['SYSTEM_ADMIN', 'System administrator', true],
  ['PSMD_STAFF', 'PSMD staff', false],
  ['DISPATCH_OFFICER', 'Dispatch officer', false],
  ['BUDGET_OFFICER', 'Budget officer', false],
  ['VIEWER', 'Viewer', false],
  ['AUDITOR', 'Auditor', false],
] as const;

const permissions = [
  'fuel.create',
  'fuel.read',
  'fuel.post',
  'fuel.void',
  'fuel.export',
  'dispatch.create',
  'dispatch.read',
  'dispatch.update',
  'dispatch.complete',
  'dispatch.cancel',
  'office.manage',
  'vehicle.manage',
  'driver.manage',
  'budget.manage',
  'user.read',
  'user.manage',
  'user.password.reset',
  'user.totp.reset',
  'user.session.revoke',
  'role.read',
  'role.manage',
  'role.assign_privileged',
  'audit.read',
  'report.export',
] as const;

const assignments: Readonly<Record<(typeof roles)[number][0], readonly string[] | 'ALL'>> = {
  SUPER_ADMIN: 'ALL',
  SYSTEM_ADMIN: [
    'user.read',
    'user.manage',
    'user.password.reset',
    'user.totp.reset',
    'user.session.revoke',
    'role.read',
    'role.manage',
    'office.manage',
    'vehicle.manage',
    'driver.manage',
    'budget.manage',
  ],
  PSMD_STAFF: ['fuel.create', 'fuel.read', 'fuel.post', 'fuel.export'],
  DISPATCH_OFFICER: [
    'dispatch.create',
    'dispatch.read',
    'dispatch.update',
    'dispatch.complete',
    'dispatch.cancel',
  ],
  BUDGET_OFFICER: ['budget.manage', 'fuel.read', 'report.export'],
  VIEWER: ['fuel.read', 'dispatch.read'],
  AUDITOR: ['fuel.read', 'dispatch.read', 'audit.read', 'report.export'],
};

export async function up(database: Kysely<Database>): Promise<void> {
  await database.schema
    .createTable('users')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('username', 'varchar(64)', (column) => column.notNull().unique())
    .addColumn('email', 'varchar(254)', (column) => column.notNull().unique())
    .addColumn('full_name', 'varchar(200)', (column) => column.notNull())
    .addColumn('password_hash', 'varchar(255)', (column) => column.notNull())
    .addColumn('is_active', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('must_change_password', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('deleted_at', 'datetime(6)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createTable('roles')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('code', 'varchar(64)', (column) => column.notNull().unique())
    .addColumn('name', 'varchar(100)', (column) => column.notNull())
    .addColumn('is_privileged', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('is_active', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createTable('permissions')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('code', 'varchar(100)', (column) => column.notNull().unique())
    .addColumn('name', 'varchar(150)', (column) => column.notNull())
    .addColumn('is_active', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('is_system', 'boolean', (column) => column.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createTable('user_roles')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('user_id', 'bigint', (column) =>
      column.unsigned().notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('role_id', 'bigint', (column) =>
      column.unsigned().notNull().references('roles.id').onDelete('restrict'),
    )
    .addColumn('assigned_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_user_roles_user_role', ['user_id', 'role_id'])
    .execute();

  await database.schema
    .createTable('role_permissions')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('role_id', 'bigint', (column) =>
      column.unsigned().notNull().references('roles.id').onDelete('restrict'),
    )
    .addColumn('permission_id', 'bigint', (column) =>
      column.unsigned().notNull().references('permissions.id').onDelete('restrict'),
    )
    .addColumn('assigned_by_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_role_permissions_role_permission', ['role_id', 'permission_id'])
    .execute();

  await database.schema
    .createTable('user_sessions')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('user_id', 'bigint', (column) =>
      column.unsigned().notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('token_hash', 'binary(32)', (column) => column.notNull().unique())
    .addColumn('csrf_token_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('is_privileged', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('last_seen_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('idle_expires_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('absolute_expires_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('revoked_at', 'datetime(6)')
    .addColumn('revoke_reason', 'varchar(100)')
    .execute();

  await database.schema
    .createIndex('idx_user_sessions_active_user')
    .on('user_sessions')
    .columns(['user_id', 'revoked_at', 'absolute_expires_at'])
    .execute();

  await database.schema
    .createTable('authentication_challenges')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('user_id', 'bigint', (column) =>
      column.unsigned().notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('token_hash', 'binary(32)', (column) => column.notNull().unique())
    .addColumn('csrf_token_hash', 'binary(32)', (column) => column.notNull())
    .addColumn('challenge_type', 'varchar(32)', (column) => column.notNull())
    .addColumn('failed_attempts', 'smallint', (column) => column.unsigned().notNull().defaultTo(0))
    .addColumn('expires_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('consumed_at', 'datetime(6)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint(
      'chk_authentication_challenge_type',
      sql`challenge_type in ('PASSWORD_CHANGE', 'TOTP_ENROLLMENT', 'TOTP_VERIFICATION')`,
    )
    .execute();

  await database.schema
    .createIndex('idx_authentication_challenges_user')
    .on('authentication_challenges')
    .columns(['user_id', 'consumed_at', 'expires_at'])
    .execute();

  await database.schema
    .createTable('login_rate_limits')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('bucket_type', 'varchar(32)', (column) => column.notNull())
    .addColumn('bucket_key', 'binary(32)', (column) => column.notNull())
    .addColumn('window_started_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('failure_count', 'smallint', (column) => column.unsigned().notNull().defaultTo(0))
    .addColumn('locked_until', 'datetime(6)')
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addUniqueConstraint('uq_login_rate_limits_bucket', ['bucket_type', 'bucket_key'])
    .addCheckConstraint(
      'chk_login_rate_limit_type',
      sql`bucket_type in ('ACCOUNT', 'SOURCE', 'TOTP')`,
    )
    .execute();

  await database.schema
    .createTable('user_totp_factors')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('user_id', 'bigint', (column) =>
      column.unsigned().notNull().unique().references('users.id').onDelete('restrict'),
    )
    .addColumn('status', 'varchar(16)', (column) => column.notNull())
    .addColumn('secret_ciphertext', 'varbinary(512)', (column) => column.notNull())
    .addColumn('secret_iv', 'binary(12)', (column) => column.notNull())
    .addColumn('secret_auth_tag', 'binary(16)', (column) => column.notNull())
    .addColumn('key_version', 'integer', (column) => column.unsigned().notNull())
    .addColumn('last_used_counter', 'bigint', (column) => column.unsigned())
    .addColumn('confirmed_at', 'datetime(6)')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .addColumn('updated_at', 'datetime(6)', (column) => column.notNull())
    .addCheckConstraint(
      'chk_user_totp_factor_status',
      sql`status in ('PENDING', 'ENABLED', 'DISABLED')`,
    )
    .execute();

  await database.schema
    .createTable('admin_password_resets')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('actor_user_id', 'bigint', (column) =>
      column.unsigned().notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('target_user_id', 'bigint', (column) =>
      column.unsigned().notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('request_id', 'varchar(64)', (column) => column.notNull())
    .addColumn('reason', 'varchar(500)', (column) => column.notNull())
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createIndex('idx_admin_password_resets_target')
    .on('admin_password_resets')
    .columns(['target_user_id', 'created_at'])
    .execute();

  await database.schema
    .createTable('auth_security_events')
    .addColumn('id', 'bigint', (column) => column.unsigned().autoIncrement().primaryKey())
    .addColumn('public_id', 'binary(16)', (column) => column.notNull().unique())
    .addColumn('event_type', 'varchar(100)', (column) => column.notNull())
    .addColumn('actor_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('target_user_id', 'bigint', (column) =>
      column.unsigned().references('users.id').onDelete('restrict'),
    )
    .addColumn('request_id', 'varchar(64)', (column) => column.notNull())
    .addColumn('reason_code', 'varchar(100)')
    .addColumn('metadata', 'json')
    .addColumn('created_at', 'datetime(6)', (column) => column.notNull())
    .execute();

  await database.schema
    .createIndex('idx_auth_security_events_target')
    .on('auth_security_events')
    .columns(['target_user_id', 'created_at'])
    .execute();

  await seedCatalog(database);
}

async function seedCatalog(database: Kysely<Database>): Promise<void> {
  await database
    .insertInto('roles')
    .values(
      roles.map(([code, name, isPrivileged], index) => ({
        public_id: deterministicPublicId('7000', index + 1),
        code,
        name,
        is_privileged: isPrivileged,
        is_active: true,
        is_system: true,
        created_at: seededAt,
        updated_at: seededAt,
      })),
    )
    .execute();

  await database
    .insertInto('permissions')
    .values(
      permissions.map((code, index) => ({
        public_id: deterministicPublicId('7001', index + 1),
        code,
        name: code.replaceAll('.', ' '),
        is_active: true,
        is_system: true,
        created_at: seededAt,
        updated_at: seededAt,
      })),
    )
    .execute();

  const roleRows = await database.selectFrom('roles').select(['id', 'code']).execute();
  const permissionRows = await database.selectFrom('permissions').select(['id', 'code']).execute();
  const roleIds = new Map(roleRows.map((role) => [role.code, role.id]));
  const permissionIds = new Map(
    permissionRows.map((permission) => [permission.code, permission.id]),
  );

  const rows = roles.flatMap(([roleCode]) => {
    const roleId = roleIds.get(roleCode);
    if (roleId === undefined) throw new Error(`Seeded role ${roleCode} was not found.`);
    const assignedPermissions =
      assignments[roleCode] === 'ALL' ? permissions : assignments[roleCode];

    return assignedPermissions.map((permissionCode) => {
      const permissionId = permissionIds.get(permissionCode);
      if (permissionId === undefined) {
        throw new Error(`Seeded permission ${permissionCode} was not found.`);
      }
      return {
        role_id: roleId,
        permission_id: permissionId,
        assigned_by_user_id: null,
        created_at: seededAt,
      };
    });
  });

  await database.insertInto('role_permissions').values(rows).execute();
}

function deterministicPublicId(group: string, ordinal: number): Buffer {
  const suffix = ordinal.toString(16).padStart(12, '0');
  return Buffer.from(parseUuid(`019d0000-0000-${group}-8000-${suffix}`));
}

export async function down(database: Kysely<Database>): Promise<void> {
  for (const table of [
    'auth_security_events',
    'admin_password_resets',
    'user_totp_factors',
    'login_rate_limits',
    'authentication_challenges',
    'user_sessions',
    'role_permissions',
    'user_roles',
    'permissions',
    'roles',
    'users',
  ] as const) {
    await database.schema.dropTable(table).execute();
  }
}
