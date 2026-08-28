import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { SessionRecord } from '@/application/auth/ports/session-repository';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let transaction: KyselyAuthTransaction;

const userPublicId = '01900000-0000-7000-8000-000000000101';
const sessionPublicId = '01900000-0000-7000-8000-000000000102';

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
  transaction = new KyselyAuthTransaction(database);
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`update authentication_settings
    set mfa_required = false, updated_by_user_id = null, updated_at = '2026-08-28 00:00:00.000000'`.execute(
    database,
  );
  await sql`delete from admin_password_resets`.execute(database);
  await sql`delete from user_totp_factors`.execute(database);
  await sql`delete from login_rate_limits`.execute(database);
  await sql`delete from authentication_challenges`.execute(database);
  await sql`delete from user_sessions`.execute(database);
  await sql`delete from user_roles`.execute(database);
  await sql`delete from users`.execute(database);
  await sql`delete rp from role_permissions rp inner join roles r on r.id = rp.role_id where r.is_system = 0`.execute(
    database,
  );
  await sql`delete from roles where is_system = 0`.execute(database);
});

afterAll(async () => {
  await database.destroy();
});

async function createUser(
  input: {
    publicId: string;
    username: string;
    email: string;
  } = {
    publicId: userPublicId,
    username: 'system.admin',
    email: 'system.admin@example.lan',
  },
): Promise<void> {
  await transaction.execute(async ({ users }) => {
    await users.create({
      publicId: input.publicId,
      username: input.username,
      email: input.email,
      fullName: 'System Administrator',
      passwordHash: '$argon2id$test-only',
      mustChangePassword: true,
      createdAt: new Date('2026-08-28T00:00:00.000Z'),
    });
  });
}

describe('Kysely authentication repositories', () => {
  it('persists the global MFA requirement with administrator evidence', async () => {
    await createUser();
    const settings = createKyselyAuthRepositories(database).authenticationSettings;

    await expect(settings.get()).resolves.toEqual({
      mfaRequired: false,
      updatedAt: new Date('2026-08-28T00:00:00.000Z'),
      updatedByUserPublicId: null,
    });

    const updatedAt = new Date('2026-08-28T02:00:00.000Z');
    await expect(
      settings.update({
        mfaRequired: true,
        updatedAt,
        updatedByUserPublicId: userPublicId,
      }),
    ).resolves.toEqual({
      mfaRequired: true,
      updatedAt,
      updatedByUserPublicId: userPublicId,
    });
  });

  it('maps users and resolves active role permissions without internal identifiers', async () => {
    await createUser();

    await transaction.execute(async ({ roles }) => {
      const superAdmin = (await roles.list()).find((role) => role.code === 'SUPER_ADMIN');
      expect(superAdmin).toBeDefined();
      await roles.replaceUserRoles(userPublicId, [superAdmin!.publicId], new Date());
    });

    const repositories = createKyselyAuthRepositories(database);
    const user = await repositories.users.findForAuthentication('system.admin');

    expect(user).toMatchObject({
      publicId: userPublicId,
      username: 'system.admin',
      isPrivileged: true,
      roles: ['SUPER_ADMIN'],
    });
    expect(user?.permissions).toContain('role.assign_privileged');
    expect(user).not.toHaveProperty('id');
  });

  it('stores and resolves only session token hashes', async () => {
    await createUser();
    const tokenHash = Uint8Array.from({ length: 32 }, (_, index) => index);
    const csrfTokenHash = Uint8Array.from({ length: 32 }, (_, index) => 31 - index);
    const session: SessionRecord = {
      publicId: sessionPublicId,
      userPublicId,
      tokenHash,
      csrfTokenHash,
      isPrivileged: false,
      createdAt: new Date('2026-08-28T00:00:00.000Z'),
      lastSeenAt: new Date('2026-08-28T00:00:00.000Z'),
      idleExpiresAt: new Date('2026-08-28T00:30:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-28T08:00:00.000Z'),
      revokedAt: null,
      revokeReason: null,
    };

    await transaction.execute(async ({ sessions }) => sessions.create(session));
    const stored = await database
      .selectFrom('user_sessions')
      .select(['token_hash', 'csrf_token_hash'])
      .executeTakeFirstOrThrow();

    expect(stored.token_hash).toEqual(Buffer.from(tokenHash));
    expect(stored.csrf_token_hash).toEqual(Buffer.from(csrfTokenHash));
    await expect(
      createKyselyAuthRepositories(database).sessions.findByTokenHash(tokenHash),
    ).resolves.toMatchObject({ publicId: sessionPublicId, userPublicId });
  });

  it('durably locks a rate bucket at the fifth failure', async () => {
    const bucketKey = new Uint8Array(32).fill(7);
    const now = new Date('2026-08-28T00:00:00.000Z');

    const result = await transaction.execute(async ({ rateLimits }) => {
      let current = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        current = await rateLimits.recordFailure({
          bucketType: 'ACCOUNT',
          bucketKey,
          now,
          windowSeconds: 900,
          lockSeconds: 900,
          maximumFailures: 5,
        });
      }
      return current;
    });

    expect(result?.failureCount).toBe(5);
    expect(result?.lockedUntil?.toISOString()).toBe('2026-08-28T00:15:00.000Z');
  });

  it('rolls back a security event when its workflow fails', async () => {
    await expect(
      transaction.execute(async ({ auditEvents }) => {
        await auditEvents.append({
          publicId: '01900000-0000-7000-8000-000000000103',
          schemaVersion: 1,
          occurredAt: '2026-08-28T00:00:00.000Z',
          actorPublicId: null,
          action: 'auth.test',
          entity: null,
          requestId: '01900000-0000-7000-8000-000000000104',
          ipAddress: null,
          userAgent: null,
          reasonCode: 'test',
          before: null,
          after: null,
          metadata: {},
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const count = await sql<{ count: string }>`
      select count(*) as count from fvdms_audit.audit_outbox
    `.execute(database);
    expect(count.rows[0]?.count).toBe('0');
  });

  it('covers user, role, and permission administration state transitions', async () => {
    await createUser();
    const repositories = createKyselyAuthRepositories(database);
    const at = new Date('2026-08-28T01:00:00.000Z');
    const customRolePublicId = '01900000-0000-7000-8000-000000000110';
    const permissions = await repositories.permissions.list();
    const permission = permissions[0]!;

    expect(await repositories.users.list({ page: 1, pageSize: 20 })).toMatchObject({ total: 1 });
    expect(
      await repositories.users.list({ page: 1, pageSize: 20, query: 'System Admin' }),
    ).toMatchObject({ total: 1 });
    expect(await repositories.users.list({ page: 1, pageSize: 20, query: '   ' })).toMatchObject({
      total: 1,
    });
    await expect(
      repositories.users.findByPublicId('01900000-0000-7000-8000-000000000999'),
    ).resolves.toBeNull();

    await repositories.roles.create({
      publicId: customRolePublicId,
      code: 'CUSTOM_REVIEWER',
      name: 'Reviewer',
      isPrivileged: false,
      createdAt: at,
    });
    await expect(repositories.roles.findByPublicIds([])).resolves.toEqual([]);
    await expect(
      repositories.roles.findByPublicId('01900000-0000-7000-8000-000000000998'),
    ).resolves.toBeNull();
    await repositories.permissions.replaceRolePermissions(customRolePublicId, [], at);
    await repositories.permissions.replaceRolePermissions(
      customRolePublicId,
      [permission.publicId],
      at,
    );
    await expect(
      repositories.permissions.replaceRolePermissions(
        customRolePublicId,
        ['01900000-0000-7000-8000-000000000997'],
        at,
      ),
    ).rejects.toThrow('unavailable');

    await repositories.roles.replaceUserRoles(userPublicId, [], at);
    await repositories.roles.replaceUserRoles(userPublicId, [customRolePublicId], at);
    await expect(
      repositories.roles.replaceUserRoles(
        userPublicId,
        ['01900000-0000-7000-8000-000000000996'],
        at,
      ),
    ).rejects.toThrow('unavailable');
    await repositories.roles.replaceUserRoles(userPublicId, [customRolePublicId], at);
    await expect(repositories.roles.userPublicIdsForRole(customRolePublicId)).resolves.toEqual([
      userPublicId,
    ]);
    await expect(repositories.roles.findByPublicIds([customRolePublicId])).resolves.toHaveLength(1);
    await expect(
      repositories.roles.update({
        publicId: customRolePublicId,
        name: 'Privileged reviewer',
        isPrivileged: true,
        isActive: false,
        updatedAt: at,
      }),
    ).resolves.toBe(true);
    await expect(
      repositories.roles.update({
        publicId: '01900000-0000-7000-8000-000000000995',
        updatedAt: at,
      }),
    ).resolves.toBe(false);

    await expect(
      repositories.users.updateIdentity({
        publicId: userPublicId,
        email: 'updated@example.lan',
        fullName: 'Updated Administrator',
        isActive: false,
        updatedAt: at,
      }),
    ).resolves.toBe(true);
    await expect(
      repositories.users.updateIdentity({
        publicId: '01900000-0000-7000-8000-000000000994',
        updatedAt: at,
      }),
    ).resolves.toBe(false);
    await expect(
      repositories.users.updatePassword({
        publicId: userPublicId,
        passwordHash: '$argon2id$updated',
        mustChangePassword: false,
        updatedAt: at,
      }),
    ).resolves.toBe(true);
    await expect(repositories.users.softDelete(userPublicId, at)).resolves.toBe(true);
    await expect(repositories.users.softDelete(userPublicId, at)).resolves.toBe(false);
    await expect(repositories.users.restoreInactive(userPublicId, at)).resolves.toBe(true);
    await expect(repositories.users.restoreInactive(userPublicId, at)).resolves.toBe(false);
    await expect(repositories.users.countActiveUsersWithRole('CUSTOM_REVIEWER')).resolves.toBe(0);
  });

  it('covers session activity, rotation, listing, and revocation transitions', async () => {
    await createUser();
    const repositories = createKyselyAuthRepositories(database);
    const tokenHash = new Uint8Array(32).fill(11);
    const at = new Date('2026-08-28T01:00:00.000Z');
    await repositories.sessions.create({
      publicId: sessionPublicId,
      userPublicId,
      tokenHash,
      csrfTokenHash: new Uint8Array(32).fill(12),
      isPrivileged: true,
      createdAt: at,
      lastSeenAt: at,
      idleExpiresAt: new Date('2026-08-28T01:30:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-28T09:00:00.000Z'),
      revokedAt: null,
      revokeReason: null,
    });

    await expect(repositories.sessions.countActivePrivileged(userPublicId, at)).resolves.toBe(1);
    await expect(
      repositories.sessions.updateActivity(
        sessionPublicId,
        new Date('2026-08-28T01:05:00.000Z'),
        new Date('2026-08-28T01:35:00.000Z'),
      ),
    ).resolves.toBe(true);
    await expect(
      repositories.sessions.updateActivity('01900000-0000-7000-8000-000000000993', at, at),
    ).resolves.toBe(false);
    await expect(
      repositories.sessions.replaceCsrfTokenHash(sessionPublicId, new Uint8Array(32).fill(13)),
    ).resolves.toBe(true);
    await expect(repositories.sessions.listForUser(userPublicId)).resolves.toHaveLength(1);
    await expect(
      repositories.sessions.revoke(sessionPublicId, at, 'operator_request'),
    ).resolves.toBe(true);
    await expect(
      repositories.sessions.revoke(sessionPublicId, at, 'operator_request'),
    ).resolves.toBe(false);
    await expect(
      repositories.sessions.replaceCsrfTokenHash(sessionPublicId, new Uint8Array(32).fill(14)),
    ).resolves.toBe(false);
    await expect(repositories.sessions.revokeForUser(userPublicId, at, 'cleanup')).resolves.toBe(0);
  });

  it('covers challenge, TOTP factor, and reset-evidence transitions', async () => {
    await createUser();
    const repositories = createKyselyAuthRepositories(database);
    const at = new Date('2026-08-28T01:00:00.000Z');
    const challengePublicId = '01900000-0000-7000-8000-000000000120';
    const secondChallengePublicId = '01900000-0000-7000-8000-000000000121';
    const tokenHash = new Uint8Array(32).fill(21);
    const factorPublicId = '01900000-0000-7000-8000-000000000122';

    await expect(repositories.challenges.findByTokenHash(tokenHash)).resolves.toBeNull();
    await repositories.challenges.create({
      publicId: challengePublicId,
      userPublicId,
      tokenHash,
      csrfTokenHash: new Uint8Array(32).fill(22),
      type: 'TOTP_ENROLLMENT',
      failedAttempts: 0,
      expiresAt: new Date('2026-08-28T01:05:00.000Z'),
      consumedAt: null,
      createdAt: at,
    });
    await expect(repositories.challenges.findByTokenHash(tokenHash)).resolves.toMatchObject({
      publicId: challengePublicId,
      failedAttempts: 0,
    });
    await expect(repositories.challenges.incrementFailure(challengePublicId)).resolves.toBe(1);
    await expect(
      repositories.challenges.incrementFailure('01900000-0000-7000-8000-000000000992'),
    ).resolves.toBe(0);
    await expect(
      repositories.challenges.replaceCsrfTokenHash(challengePublicId, new Uint8Array(32).fill(23)),
    ).resolves.toBe(true);
    await expect(repositories.challenges.consume(challengePublicId, at)).resolves.toBe(true);
    await expect(repositories.challenges.consume(challengePublicId, at)).resolves.toBe(false);
    await expect(
      repositories.challenges.replaceCsrfTokenHash(challengePublicId, new Uint8Array(32).fill(24)),
    ).resolves.toBe(false);
    await repositories.challenges.create({
      publicId: secondChallengePublicId,
      userPublicId,
      tokenHash: new Uint8Array(32).fill(25),
      csrfTokenHash: new Uint8Array(32).fill(26),
      type: 'TOTP_VERIFICATION',
      failedAttempts: 0,
      expiresAt: new Date('2026-08-28T01:05:00.000Z'),
      consumedAt: null,
      createdAt: at,
    });
    await expect(repositories.challenges.revokeForUser(userPublicId, at)).resolves.toBe(1);

    await expect(repositories.totpFactors.findForUser(userPublicId)).resolves.toBeNull();
    const factor = {
      publicId: factorPublicId,
      userPublicId,
      status: 'PENDING' as const,
      encryptedSecret: {
        ciphertext: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array(12).fill(2),
        authenticationTag: new Uint8Array(16).fill(3),
        keyVersion: 1,
      },
      lastUsedCounter: null,
      confirmedAt: null,
      createdAt: at,
      updatedAt: at,
    };
    await repositories.totpFactors.save(factor);
    await expect(repositories.totpFactors.findForUser(userPublicId)).resolves.toMatchObject({
      publicId: factorPublicId,
      status: 'PENDING',
      lastUsedCounter: null,
    });
    await repositories.totpFactors.save({
      ...factor,
      encryptedSecret: { ...factor.encryptedSecret, ciphertext: new Uint8Array([4, 5, 6]) },
    });
    await expect(repositories.totpFactors.enable(factorPublicId, at, 100)).resolves.toBe(true);
    await expect(repositories.totpFactors.enable(factorPublicId, at, 100)).resolves.toBe(false);
    await expect(repositories.totpFactors.acceptCounter(factorPublicId, 101, at)).resolves.toBe(
      true,
    );
    await expect(repositories.totpFactors.acceptCounter(factorPublicId, 101, at)).resolves.toBe(
      false,
    );
    await expect(repositories.totpFactors.disableForUser(userPublicId, at)).resolves.toBe(true);
    await expect(repositories.totpFactors.disableForUser(userPublicId, at)).resolves.toBe(false);

    await repositories.passwordResets.record({
      publicId: '01900000-0000-7000-8000-000000000123',
      actorPublicId: userPublicId,
      targetPublicId: userPublicId,
      requestId: '01900000-0000-7000-8000-000000000124',
      reason: 'Verified recovery request',
      createdAt: at,
    });
    const resetCount = await database
      .selectFrom('admin_password_resets')
      .select((expression) => expression.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    expect(resetCount.count).toBe('1');
  });

  it('returns not found when repository foreign-key public IDs cannot be resolved', async () => {
    const repositories = createKyselyAuthRepositories(database);
    await expect(
      repositories.sessions.revokeForUser(
        '01900000-0000-7000-8000-000000000991',
        new Date(),
        'missing',
      ),
    ).rejects.toMatchObject({ httpStatus: 404 });
    await expect(
      repositories.roles.userPublicIdsForRole('01900000-0000-7000-8000-000000000990'),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });
});
