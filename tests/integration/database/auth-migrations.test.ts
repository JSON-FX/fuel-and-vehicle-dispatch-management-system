import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { createTestDatabase } from '../helpers/test-database';

interface ColumnDescription {
  readonly TABLE_NAME: string;
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

describe('authentication and RBAC migration', () => {
  it('creates every normalized authentication table', async () => {
    const result = await sql<{ TABLE_NAME: string }>`
      select TABLE_NAME
      from information_schema.tables
      where table_schema = database()
    `.execute(database);

    expect(result.rows.map((row) => row.TABLE_NAME)).toEqual(
      expect.arrayContaining([
        'users',
        'roles',
        'permissions',
        'user_roles',
        'role_permissions',
        'user_sessions',
        'authentication_challenges',
        'login_rate_limits',
        'user_totp_factors',
        'admin_password_resets',
        'auth_security_events',
      ]),
    );
  });

  it('uses binary tokens, encrypted factor fields, and microsecond timestamps', async () => {
    const result = await sql<ColumnDescription>`
      select TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, DATETIME_PRECISION
      from information_schema.columns
      where table_schema = database()
        and TABLE_NAME in ('user_sessions', 'authentication_challenges', 'login_rate_limits', 'user_totp_factors')
    `.execute(database);
    const columns = new Map(
      result.rows.map((column) => [`${column.TABLE_NAME}.${column.COLUMN_NAME}`, column]),
    );

    expect(columns.get('user_sessions.token_hash')?.COLUMN_TYPE).toBe('binary(32)');
    expect(columns.get('user_sessions.csrf_token_hash')?.COLUMN_TYPE).toBe('binary(32)');
    expect(columns.get('authentication_challenges.token_hash')?.COLUMN_TYPE).toBe('binary(32)');
    expect(columns.get('login_rate_limits.bucket_key')?.COLUMN_TYPE).toBe('binary(32)');
    expect(columns.get('user_totp_factors.secret_ciphertext')?.DATA_TYPE).toBe('varbinary');
    expect(columns.get('user_totp_factors.secret_iv')?.COLUMN_TYPE).toBe('binary(12)');
    expect(columns.get('user_totp_factors.secret_auth_tag')?.COLUMN_TYPE).toBe('binary(16)');
    expect(columns.get('user_sessions.absolute_expires_at')?.DATETIME_PRECISION).toBe(6);

    expect(
      result.rows.some(
        (column) =>
          /password|token|secret/i.test(column.COLUMN_NAME) &&
          /plain|raw/i.test(column.COLUMN_NAME),
      ),
    ).toBe(false);
  });

  it('seeds the stable role and permission catalog with least-privilege assignments', async () => {
    const roles = await database
      .selectFrom('roles')
      .select(['code', 'is_privileged'])
      .orderBy('code')
      .execute();
    expect(roles.map((role) => role.code)).toEqual([
      'AUDITOR',
      'BUDGET_OFFICER',
      'DISPATCH_OFFICER',
      'PSMD_STAFF',
      'SUPER_ADMIN',
      'SYSTEM_ADMIN',
      'VIEWER',
    ]);
    expect(roles.filter((role) => role.is_privileged === 1).map((role) => role.code)).toEqual([
      'SUPER_ADMIN',
      'SYSTEM_ADMIN',
    ]);

    const permissions = await database
      .selectFrom('permissions')
      .select('code')
      .orderBy('code')
      .execute();
    expect(permissions).toHaveLength(24);
    expect(permissions.map((permission) => permission.code)).toEqual(
      expect.arrayContaining(['role.assign_privileged', 'user.totp.reset', 'fuel.void']),
    );

    const privilegedAssignment = await database
      .selectFrom('role_permissions')
      .innerJoin('roles', 'roles.id', 'role_permissions.role_id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('roles.code as role_code')
      .where('permissions.code', '=', 'role.assign_privileged')
      .execute();
    expect(privilegedAssignment).toEqual([{ role_code: 'SUPER_ADMIN' }]);
  });

  it('enforces normalized user identity and bearer-token uniqueness', async () => {
    const indexes = await sql<{ TABLE_NAME: string; COLUMN_NAME: string; NON_UNIQUE: string }>`
      select TABLE_NAME, COLUMN_NAME, NON_UNIQUE
      from information_schema.statistics
      where table_schema = database()
        and ((TABLE_NAME = 'users' and COLUMN_NAME in ('public_id', 'username', 'email'))
          or (TABLE_NAME = 'user_sessions' and COLUMN_NAME = 'token_hash'))
    `.execute(database);

    for (const column of ['public_id', 'username', 'email']) {
      expect(indexes.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ TABLE_NAME: 'users', COLUMN_NAME: column, NON_UNIQUE: '0' }),
        ]),
      );
    }
    expect(indexes.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          TABLE_NAME: 'user_sessions',
          COLUMN_NAME: 'token_hash',
          NON_UNIQUE: '0',
        }),
      ]),
    );
  });
});
