import { describe, expect, it } from 'vitest';

import { Logout } from '@/application/auth/use-cases/logout';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from './support/auth-fakes';

describe('Logout', () => {
  it('revokes the current session idempotently', async () => {
    const revoked: string[] = [];
    const logout = new Logout({
      transaction: new FakeAuthTransaction(
        authRepositories({
          sessions: {
            findByTokenHash: async () => ({
              publicId: 'session-public-id',
              userPublicId: '01900000-0000-7000-8000-000000000100',
            }),
            revoke: async (publicId: string) => {
              revoked.push(publicId);
              return true;
            },
          } as never,
          securityEvents: { append: async () => undefined },
        }),
      ),
      tokenGenerator: { hashToken: () => new Uint8Array(32) } as never,
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await logout.execute({ bearerToken: 'raw-token', requestId: 'request-id' });

    expect(revoked).toEqual(['session-public-id']);
  });
});
