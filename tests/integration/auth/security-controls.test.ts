import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import { AssignUserRoles } from '@/application/auth/use-cases/assign-user-roles';
import { AesGcmSecretEncryptor } from '@/infrastructure/auth/aes-gcm-secret-encryptor';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
const now = new Date('2026-08-28T00:00:00.000Z');

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
});

beforeEach(async () => clearAuthenticationData(database));
afterAll(async () => database.destroy());

describe('authentication security controls', () => {
  it('serializes concurrent rate-limit increments without losing failures', async () => {
    const bucketKey = new Uint8Array(32).fill(9);
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        new KyselyAuthTransaction(database).execute(({ rateLimits }) =>
          rateLimits.recordFailure({
            bucketType: 'ACCOUNT',
            bucketKey,
            now,
            windowSeconds: 900,
            lockSeconds: 900,
            maximumFailures: 5,
          }),
        ),
      ),
    );

    expect(Math.max(...attempts.map((attempt) => attempt.failureCount))).toBe(5);
    const stored = await database
      .selectFrom('login_rate_limits')
      .select(['failure_count', 'locked_until'])
      .executeTakeFirstOrThrow();
    expect(stored.failure_count).toBe(5);
    expect(stored.locked_until).toEqual(new Date('2026-08-28T00:15:00.000Z'));
  });

  it('revokes target sessions immediately when role assignments change', async () => {
    const repositories = createKyselyAuthRepositories(database);
    const passwordHash = await new Argon2PasswordHasher().hash('CorrectPassword123!');
    const actorPublicId = await insertUser('administrator', passwordHash);
    const targetPublicId = await insertUser('dispatcher', passwordHash);
    const roles = await repositories.roles.list();
    const viewer = roles.find((role) => role.code === 'VIEWER')!;
    const dispatcher = roles.find((role) => role.code === 'DISPATCH_OFFICER')!;
    await repositories.roles.replaceUserRoles(targetPublicId, [dispatcher.publicId], now);
    await repositories.sessions.create({
      publicId: new UuidV7Generator().generate().toString(),
      userPublicId: targetPublicId,
      tokenHash: new Uint8Array(32).fill(1),
      csrfTokenHash: new Uint8Array(32).fill(2),
      isPrivileged: false,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date('2026-08-28T00:30:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-28T08:00:00.000Z'),
      revokedAt: null,
      revokeReason: null,
    });
    const actor: CurrentPrincipal = {
      userPublicId: actorPublicId,
      username: 'administrator',
      fullName: 'Administrator',
      roles: ['SUPER_ADMIN'],
      permissions: ['role.manage', 'role.assign_privileged'],
      isPrivileged: true,
      mustChangePassword: false,
      mfaEnrolled: true,
    };

    await new AssignUserRoles({
      transaction: new KyselyAuthTransaction(database),
      publicIds: new UuidV7Generator(),
      clock: { now: () => now },
    }).execute({
      actor,
      targetPublicId,
      rolePublicIds: [viewer.publicId],
      requestId: 'role-change',
    });

    expect(
      await database
        .selectFrom('user_sessions')
        .select(['revoked_at', 'revoke_reason'])
        .executeTakeFirstOrThrow(),
    ).toMatchObject({ revoked_at: now, revoke_reason: 'roles_changed' });
    expect((await repositories.users.findByPublicId(targetPublicId))?.roles).toEqual(['VIEWER']);
  });

  it('encrypts TOTP material with user-bound additional data and detects tampering', () => {
    const encryptor = new AesGcmSecretEncryptor({ 1: Buffer.alloc(32, 4).toString('base64') }, 1);
    const encrypted = encryptor.encrypt('BASE32SECRET', 'user-a:factor-a');

    expect(encryptor.decrypt(encrypted, 'user-a:factor-a')).toBe('BASE32SECRET');
    expect(() => encryptor.decrypt(encrypted, 'user-b:factor-a')).toThrow();
    expect(() =>
      encryptor.decrypt({ ...encrypted, authenticationTag: new Uint8Array(16) }, 'user-a:factor-a'),
    ).toThrow();
  });

  it('rolls back a security-state mutation and its event together', async () => {
    const passwordHash = await new Argon2PasswordHasher().hash('CorrectPassword123!');
    const userPublicId = await insertUser('rollback.user', passwordHash);
    await expect(
      new KyselyAuthTransaction(database).execute(async ({ users, securityEvents }) => {
        await users.updateIdentity({ publicId: userPublicId, isActive: false, updatedAt: now });
        await securityEvents.append({
          publicId: new UuidV7Generator().generate().toString(),
          type: 'auth.test.rollback',
          actorPublicId: userPublicId,
          targetPublicId: userPublicId,
          requestId: 'rollback',
          reasonCode: 'test',
          metadata: {},
          occurredAt: now,
        });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    expect(
      (await createKyselyAuthRepositories(database).users.findByPublicId(userPublicId))?.isActive,
    ).toBe(true);
    expect(await database.selectFrom('auth_security_events').selectAll().execute()).toHaveLength(0);
  });
});

async function insertUser(username: string, passwordHash: string): Promise<string> {
  const publicId = new UuidV7Generator().generate().toString();
  await createKyselyAuthRepositories(database).users.create({
    publicId,
    username,
    email: `${username}@example.lan`,
    fullName: username,
    passwordHash,
    mustChangePassword: false,
    createdAt: now,
  });
  return publicId;
}

async function clearAuthenticationData(target: Kysely<Database>): Promise<void> {
  for (const table of [
    'auth_security_events',
    'admin_password_resets',
    'user_totp_factors',
    'login_rate_limits',
    'authentication_challenges',
    'user_sessions',
    'user_roles',
    'users',
  ] as const)
    await sql`delete from ${sql.table(table)}`.execute(target);
}
