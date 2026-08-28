import { describe, expect, it } from 'vitest';

import { AuthenticateSession } from '@/application/auth/services/authenticate-session';

import { authRepositories, FakeAuthTransaction } from './support/auth-fakes';
import type { UserAuthenticationRecord } from '@/application/auth/ports/user-repository';

const now = new Date('2026-08-28T00:10:00.000Z');
const user: UserAuthenticationRecord = {
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

describe('AuthenticateSession', () => {
  it('returns a principal and performs a bounded activity update', async () => {
    const activity: Date[] = [];
    const service = new AuthenticateSession({
      transaction: new FakeAuthTransaction(
        authRepositories({
          sessions: {
            findByTokenHash: async () => ({
              publicId: '01900000-0000-7000-8000-000000000101',
              userPublicId: user.publicId,
              tokenHash: new Uint8Array(32),
              csrfTokenHash: new Uint8Array(32).fill(2),
              isPrivileged: false,
              createdAt: new Date('2026-08-28T00:00:00.000Z'),
              lastSeenAt: new Date('2026-08-28T00:00:00.000Z'),
              idleExpiresAt: new Date('2026-08-28T00:30:00.000Z'),
              absoluteExpiresAt: new Date('2026-08-28T08:00:00.000Z'),
              revokedAt: null,
              revokeReason: null,
            }),
            updateActivity: async (_id: string, lastSeenAt: Date) => {
              activity.push(lastSeenAt);
              return true;
            },
          } as never,
          users: { findByPublicId: async () => user } as never,
        }),
      ),
      tokenGenerator: {
        generateToken: () => 'unused',
        hashToken: () => new Uint8Array(32),
        generateTemporaryPassword: () => 'unused',
      },
      clock: { now: () => now },
      policy: {
        activityWriteIntervalSeconds: 300,
        standardIdleTimeoutSeconds: 1_800,
        privilegedIdleTimeoutSeconds: 900,
      },
    });

    const result = await service.execute('raw-bearer');

    expect(result.principal).toMatchObject({
      userPublicId: user.publicId,
      permissions: ['dispatch.read'],
    });
    expect(activity).toEqual([now]);
  });

  it('rejects an idle-expired session', async () => {
    const service = new AuthenticateSession({
      transaction: new FakeAuthTransaction(
        authRepositories({
          sessions: {
            findByTokenHash: async () => ({
              publicId: '01900000-0000-7000-8000-000000000101',
              userPublicId: user.publicId,
              tokenHash: new Uint8Array(32),
              csrfTokenHash: new Uint8Array(32),
              isPrivileged: false,
              createdAt: now,
              lastSeenAt: now,
              idleExpiresAt: now,
              absoluteExpiresAt: new Date('2026-08-28T08:00:00.000Z'),
              revokedAt: null,
              revokeReason: null,
            }),
          } as never,
        }),
      ),
      tokenGenerator: { hashToken: () => new Uint8Array(32) } as never,
      clock: { now: () => now },
      policy: {
        activityWriteIntervalSeconds: 300,
        standardIdleTimeoutSeconds: 1_800,
        privilegedIdleTimeoutSeconds: 900,
      },
    });

    await expect(service.execute('raw-bearer')).rejects.toMatchObject({ httpStatus: 401 });
  });
});
