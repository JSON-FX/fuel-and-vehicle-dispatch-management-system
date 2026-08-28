import { describe, expect, it } from 'vitest';

import { ResetUserTotp } from '@/application/auth/use-cases/reset-user-totp';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
  TEST_ACTOR_PUBLIC_ID,
  TEST_TARGET_PUBLIC_ID,
} from './support/auth-fakes';

describe('ResetUserTotp', () => {
  it('disables the factor and revokes sessions for a different target', async () => {
    const operations: string[] = [];
    const useCase = new ResetUserTotp({
      transaction: new FakeAuthTransaction(
        authRepositories({
          users: {
            findByPublicId: async () => ({ publicId: TEST_TARGET_PUBLIC_ID }),
          } as never,
          totpFactors: { disableForUser: async () => (operations.push('factor'), true) } as never,
          sessions: { revokeForUser: async () => (operations.push('sessions'), 1) } as never,
          challenges: { revokeForUser: async () => (operations.push('challenges'), 1) } as never,
          auditEvents: {
            append: async () => {
              operations.push('event');
            },
          },
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await useCase.execute({
      actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.totp.reset'] } as never,
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      reason: 'Authenticator unavailable.',
      requestId: 'request-id',
    });

    expect(operations).toEqual(['factor', 'sessions', 'challenges', 'event']);
  });
});
