import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

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
      ]),
    );
    expect(result.rows.map((row) => row.TABLE_NAME)).not.toContain('auth_security_events');
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
    expect(permissions).toHaveLength(30);
    expect(permissions.map((permission) => permission.code)).toEqual(
      expect.arrayContaining([
        'audit.read',
        'audit.read_sensitive',
        'auth.settings.manage',
        'budget.read',
        'driver.read',
        'office.read',
        'role.assign_privileged',
        'user.totp.reset',
        'vehicle.read',
        'fuel.void',
      ]),
    );

    const privilegedAssignment = await database
      .selectFrom('role_permissions')
      .innerJoin('roles', 'roles.id', 'role_permissions.role_id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select('roles.code as role_code')
      .where('permissions.code', '=', 'role.assign_privileged')
      .execute();
    expect(privilegedAssignment).toEqual([{ role_code: 'SUPER_ADMIN' }]);

    const auditAssignments = await database
      .selectFrom('role_permissions')
      .innerJoin('roles', 'roles.id', 'role_permissions.role_id')
      .innerJoin('permissions', 'permissions.id', 'role_permissions.permission_id')
      .select(['roles.code as role_code', 'permissions.code as permission_code'])
      .where('permissions.code', 'in', ['audit.read', 'audit.read_sensitive'])
      .orderBy('permissions.code')
      .orderBy('roles.code')
      .execute();
    expect(auditAssignments).toEqual([
      { role_code: 'AUDITOR', permission_code: 'audit.read' },
      { role_code: 'SUPER_ADMIN', permission_code: 'audit.read' },
      { role_code: 'SYSTEM_ADMIN', permission_code: 'audit.read' },
      { role_code: 'AUDITOR', permission_code: 'audit.read_sensitive' },
      { role_code: 'SUPER_ADMIN', permission_code: 'audit.read_sensitive' },
    ]);
  });

  it('backfills legacy security events with exact identities and restores them on rollback', async () => {
    const migrator = createMigrator(database);
    const fuelRollback = await migrator.migrateDown();
    expect(fuelRollback.error).toBeUndefined();
    const settingsRollback = await migrator.migrateDown();
    expect(settingsRollback.error).toBeUndefined();
    const budgetRollback = await migrator.migrateDown();
    expect(budgetRollback.error).toBeUndefined();
    const masterDataRollback = await migrator.migrateDown();
    expect(masterDataRollback.error).toBeUndefined();
    const auditRollback = await migrator.migrateDown();
    expect(auditRollback.error).toBeUndefined();

    const userPublicId = PublicId.from('01900000-0000-7000-8000-000000000401');
    const eventPublicId = PublicId.from('01900000-0000-7000-8000-000000000402');
    await database
      .insertInto('users')
      .values({
        public_id: publicIdToBinary(userPublicId),
        username: 'migration.auditor',
        email: 'migration.auditor@example.lan',
        full_name: 'Migration Auditor',
        password_hash: 'not-a-real-password-hash',
        is_active: true,
        must_change_password: true,
        deleted_at: null,
        created_at: new Date('2026-08-28T00:00:00.000Z'),
        updated_at: new Date('2026-08-28T00:00:00.000Z'),
      })
      .execute();
    const user = await database
      .selectFrom('users')
      .select('id')
      .where('public_id', '=', publicIdToBinary(userPublicId))
      .executeTakeFirstOrThrow();

    await sql`
      insert into auth_security_events (
        public_id,
        event_type,
        actor_user_id,
        target_user_id,
        request_id,
        reason_code,
        metadata,
        created_at
      ) values (
        ${publicIdToBinary(eventPublicId)},
        'auth.user.updated',
        ${user.id},
        ${user.id},
        'legacy-request-id',
        'profile_changed',
        ${JSON.stringify({ changedFields: 2 })},
        ${new Date('2026-08-28T01:02:03.456Z')}
      )
    `.execute(database);

    const reapply = await migrator.migrateToLatest();
    expect(reapply.error).toBeUndefined();

    const backfilled = await sql<{
      source_position: string;
      legacy_security_event_id: string;
      event_public_id: Buffer;
      canonical_payload: string;
      captured_at: Date;
    }>`
      select source_position, legacy_security_event_id, event_public_id, canonical_payload, captured_at
      from fvdms_audit.audit_outbox
      where event_public_id = ${publicIdToBinary(eventPublicId)}
    `.execute(database);
    expect(backfilled.rows).toHaveLength(1);
    expect(backfilled.rows[0]?.event_public_id).toEqual(publicIdToBinary(eventPublicId));
    expect(backfilled.rows[0]?.legacy_security_event_id).toBe('1');
    expect(backfilled.rows[0]?.captured_at.toISOString()).toBe('2026-08-28T01:02:03.456Z');

    const payload = JSON.parse(backfilled.rows[0]!.canonical_payload) as Record<string, unknown>;
    expect(payload).toMatchObject({
      publicId: eventPublicId.toString(),
      schemaVersion: 1,
      action: 'auth.user.updated',
      actorPublicId: userPublicId.toString(),
      entity: { type: 'user', publicId: userPublicId.toString() },
      requestId: 'legacy-request-id',
      reasonCode: 'profile_changed',
      metadata: { changedFields: 2 },
    });

    const fuelRollbackWithData = await migrator.migrateDown();
    expect(fuelRollbackWithData.error).toBeUndefined();
    const settingsRollbackWithData = await migrator.migrateDown();
    expect(settingsRollbackWithData.error).toBeUndefined();
    const budgetRollbackWithData = await migrator.migrateDown();
    expect(budgetRollbackWithData.error).toBeUndefined();
    const masterDataRollbackWithData = await migrator.migrateDown();
    expect(masterDataRollbackWithData.error).toBeUndefined();
    const auditRollbackWithData = await migrator.migrateDown();
    expect(auditRollbackWithData.error).toBeUndefined();
    const restored = await sql<{
      public_id: Buffer;
      event_type: string;
      request_id: string;
      metadata: { changedFields: number };
    }>`
      select public_id, event_type, request_id, metadata
      from auth_security_events
      where public_id = ${publicIdToBinary(eventPublicId)}
    `.execute(database);
    expect(restored.rows).toEqual([
      {
        public_id: publicIdToBinary(eventPublicId),
        event_type: 'auth.user.updated',
        request_id: 'legacy-request-id',
        metadata: { changedFields: 2 },
      },
    ]);

    const finalReapply = await migrator.migrateToLatest();
    expect(finalReapply.error).toBeUndefined();
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
