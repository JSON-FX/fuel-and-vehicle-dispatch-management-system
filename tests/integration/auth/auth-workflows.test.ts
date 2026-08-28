import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { Clock } from '@/application/auth/ports/clock';
import { AuthenticateSession } from '@/application/auth/services/authenticate-session';
import { Login } from '@/application/auth/use-cases/login';
import { Logout } from '@/application/auth/use-cases/logout';
import { Argon2PasswordHasher } from '@/infrastructure/auth/argon2-password-hasher';
import { HmacRateLimitKey } from '@/infrastructure/auth/hmac-rate-limit-key';
import { NodeSecureTokenGenerator } from '@/infrastructure/auth/node-secure-token-generator';
import { createKyselyAuthRepositories } from '@/infrastructure/database/auth/create-kysely-auth-repositories';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let transaction: KyselyAuthTransaction;
let passwordHasher: Argon2PasswordHasher;
let dummyHash: string;
const clock: Clock & { current: Date } = {
  current: new Date('2026-08-28T00:00:00.000Z'),
  now() {
    return this.current;
  },
};

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
  transaction = new KyselyAuthTransaction(database);
  passwordHasher = new Argon2PasswordHasher();
  dummyHash = await passwordHasher.hash('dummy-password-material');
});

beforeEach(async () => {
  await clearAuthenticationData(database);
  clock.current = new Date('2026-08-28T00:00:00.000Z');
});

afterAll(async () => database.destroy());

describe('authentication workflows', () => {
  it('creates a hash-only standard session, bounds activity writes, and revokes on logout', async () => {
    const userPublicId = await createUser({ username: 'dispatcher', roleCode: 'DISPATCH_OFFICER' });
    const login = createLogin();
    const result = await login.execute({
      username: ' Dispatcher ',
      password: 'CorrectPassword123!',
      sourceAddress: '192.0.2.10',
      requestId: 'login-request',
    });

    expect(result.next).toBe('AUTHENTICATED');
    const stored = await database.selectFrom('user_sessions').selectAll().executeTakeFirstOrThrow();
    expect(stored.token_hash).toEqual(
      Buffer.from(new NodeSecureTokenGenerator().hashToken(result.credential.bearerToken)),
    );
    expect(stored.token_hash.toString('utf8')).not.toContain(result.credential.bearerToken);

    const authenticate = new AuthenticateSession({
      transaction,
      tokenGenerator: new NodeSecureTokenGenerator(),
      clock,
      policy: {
        activityWriteIntervalSeconds: 300,
        standardIdleTimeoutSeconds: 1_800,
        privilegedIdleTimeoutSeconds: 900,
      },
    });
    await expect(authenticate.execute(result.credential.bearerToken)).resolves.toMatchObject({
      principal: { userPublicId },
    });
    const originalLastSeen = stored.last_seen_at;
    clock.current = new Date('2026-08-28T00:04:59.000Z');
    await authenticate.execute(result.credential.bearerToken);
    expect(
      (await database.selectFrom('user_sessions').select('last_seen_at').executeTakeFirstOrThrow())
        .last_seen_at,
    ).toEqual(originalLastSeen);
    clock.current = new Date('2026-08-28T00:05:01.000Z');
    await authenticate.execute(result.credential.bearerToken);
    expect(
      (await database.selectFrom('user_sessions').select('last_seen_at').executeTakeFirstOrThrow())
        .last_seen_at,
    ).toEqual(clock.current);

    await new Logout({
      transaction,
      tokenGenerator: new NodeSecureTokenGenerator(),
      publicIds: new UuidV7Generator(),
      clock,
    }).execute({ bearerToken: result.credential.bearerToken, requestId: 'logout-request' });
    await expect(authenticate.execute(result.credential.bearerToken)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('uses generic credential failures and locks account and source buckets at the threshold', async () => {
    await createUser({ username: 'known.user', roleCode: 'VIEWER' });
    const login = createLogin();
    await expect(
      login.execute({
        username: 'known.user',
        password: 'wrong-password',
        sourceAddress: '192.0.2.20',
        requestId: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      login.execute({
        username: 'unknown.user',
        password: 'wrong-password',
        sourceAddress: '192.0.2.21',
        requestId: 'unknown',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const expectedCode = attempt === 4 ? 'AUTH_RATE_LIMITED' : 'INVALID_CREDENTIALS';
      await expect(
        login.execute({
          username: 'unknown.user',
          password: 'wrong-password',
          sourceAddress: '192.0.2.21',
          requestId: `unknown-${attempt}`,
        }),
      ).rejects.toMatchObject({ code: expectedCode });
    }
    const buckets = await database
      .selectFrom('login_rate_limits')
      .select(['bucket_type', 'failure_count', 'locked_until'])
      .execute();
    const lockedBuckets = buckets.filter((bucket) => bucket.locked_until !== null);
    expect(lockedBuckets).toHaveLength(2);
    expect(lockedBuckets.every((bucket) => bucket.failure_count >= 5)).toBe(true);
  });

  it('creates forced-password and privileged enrollment challenges without creating sessions', async () => {
    await createUser({ username: 'temporary.user', roleCode: 'VIEWER', mustChangePassword: true });
    const administratorPublicId = await createUser({
      username: 'system.admin',
      roleCode: 'SYSTEM_ADMIN',
    });
    await createKyselyAuthRepositories(database).authenticationSettings.update({
      mfaRequired: true,
      updatedAt: clock.current,
      updatedByUserPublicId: administratorPublicId,
    });
    const login = createLogin();

    await expect(
      login.execute({
        username: 'temporary.user',
        password: 'CorrectPassword123!',
        sourceAddress: '192.0.2.30',
        requestId: 'temporary',
      }),
    ).resolves.toMatchObject({ next: 'PASSWORD_CHANGE' });
    await expect(
      login.execute({
        username: 'system.admin',
        password: 'CorrectPassword123!',
        sourceAddress: '192.0.2.31',
        requestId: 'privileged',
      }),
    ).resolves.toMatchObject({ next: 'TOTP_ENROLLMENT' });
    expect(await database.selectFrom('user_sessions').selectAll().execute()).toHaveLength(0);
    expect(
      (
        await database
          .selectFrom('authentication_challenges')
          .select('challenge_type')
          .orderBy('challenge_type')
          .execute()
      ).map((row) => row.challenge_type),
    ).toEqual(['PASSWORD_CHANGE', 'TOTP_ENROLLMENT']);
  });

  it('authenticates a privileged user with only a password while MFA is disabled', async () => {
    await createUser({ username: 'system.admin', roleCode: 'SYSTEM_ADMIN' });

    await expect(
      createLogin().execute({
        username: 'system.admin',
        password: 'CorrectPassword123!',
        sourceAddress: '192.0.2.32',
        requestId: 'privileged-without-mfa',
      }),
    ).resolves.toMatchObject({
      next: 'AUTHENTICATED',
      principal: { isPrivileged: true },
    });
  });
});

function createLogin(): Login {
  return new Login({
    transaction,
    passwordHasher,
    tokenGenerator: new NodeSecureTokenGenerator(),
    rateLimitKeys: new HmacRateLimitKey(Buffer.alloc(32, 7).toString('base64')),
    publicIds: new UuidV7Generator(),
    clock,
    dummyPasswordHash: dummyHash,
    policy: {
      standardIdleTimeoutSeconds: 1_800,
      privilegedIdleTimeoutSeconds: 900,
      absoluteTimeoutSeconds: 28_800,
      privilegedSessionLimit: 1,
      challengeTtlSeconds: 300,
      rateLimitWindowSeconds: 900,
      rateLimitLockSeconds: 900,
      rateLimitMaxFailures: 5,
    },
  });
}

async function createUser(input: {
  username: string;
  roleCode: string;
  mustChangePassword?: boolean;
}): Promise<string> {
  const repositories = createKyselyAuthRepositories(database);
  const publicId = new UuidV7Generator().generate().toString();
  const role = (await repositories.roles.list()).find(
    (candidate) => candidate.code === input.roleCode,
  )!;
  await repositories.users.create({
    publicId,
    username: input.username,
    email: `${input.username}@example.lan`,
    fullName: input.username,
    passwordHash: await passwordHasher.hash('CorrectPassword123!'),
    mustChangePassword: input.mustChangePassword ?? false,
    createdAt: clock.current,
  });
  await repositories.roles.replaceUserRoles(publicId, [role.publicId], clock.current);
  return publicId;
}

async function clearAuthenticationData(target: Kysely<Database>): Promise<void> {
  await sql`delete from fvdms_audit.audit_outbox`.execute(target);
  await sql`delete from vehicle_dispatch_conflict_overrides`.execute(target);
  await sql`delete from vehicle_dispatches`.execute(target);
  await sql`delete from fuel_ledger_entries`.execute(target);
  await sql`delete from fuel_issuances`.execute(target);
  await sql`delete from fuel_sequence_monthly`.execute(target);
  await sql`update dispatch_schedule_settings
    set policy = 'WARN_AND_ACK', updated_by_user_id = null, updated_at = '2026-08-29 00:00:00.000000'`.execute(
    target,
  );
  await sql`update authentication_settings
    set mfa_required = false, updated_by_user_id = null, updated_at = '2026-08-28 00:00:00.000000'`.execute(
    target,
  );
  for (const table of [
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
