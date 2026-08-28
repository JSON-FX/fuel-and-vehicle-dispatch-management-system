import { describe, expect, it } from 'vitest';

import type { UserAuthenticationRecord } from '@/application/auth/ports/user-repository';
import { Login } from '@/application/auth/use-cases/login';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from './support/auth-fakes';

const now = new Date('2026-08-28T00:00:00.000Z');
const standardUser: UserAuthenticationRecord = {
  publicId: '01900000-0000-7000-8000-000000000100',
  username: 'dispatch.officer',
  email: 'dispatch@example.lan',
  fullName: 'Dispatch Officer',
  passwordHash: 'stored-hash',
  isActive: true,
  mustChangePassword: false,
  deletedAt: null,
  roles: ['DISPATCH_OFFICER'],
  permissions: ['dispatch.read'],
  isPrivileged: false,
  mfaEnrolled: false,
};

function createLogin(user: UserAuthenticationRecord | null, passwordMatches = true) {
  const sessions: unknown[] = [];
  const challenges: unknown[] = [];
  const repositories = authRepositories({
    users: {
      findForAuthentication: async () => user,
      findByPublicId: async () => user,
    } as never,
    sessions: {
      create: async (session: unknown) => {
        sessions.push(session);
      },
      countActivePrivileged: async () => 0,
    } as never,
    challenges: {
      create: async (challenge: unknown) => {
        challenges.push(challenge);
      },
    } as never,
    rateLimits: {
      find: async () => null,
      recordFailure: async () => ({
        bucketType: 'ACCOUNT',
        bucketKey: new Uint8Array(32),
        windowStartedAt: now,
        failureCount: 1,
        lockedUntil: null,
      }),
      clear: async () => undefined,
    } as never,
    auditEvents: { append: async () => undefined },
  });
  let tokenNumber = 0;
  const login = new Login({
    transaction: new FakeAuthTransaction(repositories),
    passwordHasher: {
      hash: async () => 'unused',
      verify: async () => passwordMatches,
      needsRehash: () => false,
    },
    tokenGenerator: {
      generateToken: () => `token-${++tokenNumber}`,
      hashToken: (token) => new TextEncoder().encode(token.padEnd(32, '.')).slice(0, 32),
      generateTemporaryPassword: () => 'unused',
    },
    rateLimitKeys: {
      forAccount: () => new Uint8Array(32).fill(1),
      forSource: () => new Uint8Array(32).fill(2),
      forTotp: () => new Uint8Array(32).fill(3),
    },
    publicIds: new SequencePublicIdGenerator(),
    clock: { now: () => now },
    dummyPasswordHash: 'dummy-hash',
    policy: {
      standardIdleTimeoutSeconds: 1_800,
      privilegedIdleTimeoutSeconds: 900,
      absoluteTimeoutSeconds: 28_800,
      challengeTtlSeconds: 300,
      rateLimitWindowSeconds: 900,
      rateLimitLockSeconds: 900,
      rateLimitMaxFailures: 5,
    },
  });
  return { login, sessions, challenges };
}

describe('Login', () => {
  it('creates a full opaque session for an eligible standard user', async () => {
    const { login, sessions, challenges } = createLogin(standardUser);

    const result = await login.execute({
      username: ' Dispatch.Officer ',
      password: 'correct password',
      sourceAddress: '192.0.2.10',
      requestId: 'request-id',
    });

    expect(result.next).toBe('AUTHENTICATED');
    expect(result.credential.bearerToken).toBe('token-1');
    expect(result.credential.csrfToken).toBe('token-2');
    expect(sessions).toHaveLength(1);
    expect(challenges).toHaveLength(0);
  });

  it('creates only an enrollment challenge for a privileged user without MFA', async () => {
    const { login, sessions, challenges } = createLogin({
      ...standardUser,
      isPrivileged: true,
      roles: ['SYSTEM_ADMIN'],
    });

    const result = await login.execute({
      username: standardUser.username,
      password: 'correct password',
      sourceAddress: '192.0.2.10',
      requestId: 'request-id',
    });

    expect(result.next).toBe('TOTP_ENROLLMENT');
    expect(sessions).toHaveLength(0);
    expect(challenges).toEqual([
      expect.objectContaining({ type: 'TOTP_ENROLLMENT', userPublicId: standardUser.publicId }),
    ]);
  });

  it.each([
    ['unknown user', null, true],
    ['wrong password', standardUser, false],
    ['inactive user', { ...standardUser, isActive: false }, true],
    ['deleted user', { ...standardUser, deletedAt: now }, true],
  ])('returns the same generic failure for %s', async (_case, user, passwordMatches) => {
    const { login } = createLogin(user, passwordMatches);

    await expect(
      login.execute({
        username: standardUser.username,
        password: 'submitted password',
        sourceAddress: '192.0.2.10',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });
});
