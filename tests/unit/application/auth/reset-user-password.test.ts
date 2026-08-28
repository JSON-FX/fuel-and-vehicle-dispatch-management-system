import { describe, expect, it } from 'vitest';

import { ResetUserPassword } from '@/application/auth/use-cases/reset-user-password';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from './support/auth-fakes';

describe('ResetUserPassword', () => {
  it('returns a generated credential once and records reset evidence with revocation', async () => {
    const operations: string[] = [];
    const useCase = new ResetUserPassword({
      transaction: new FakeAuthTransaction(
        authRepositories({
          users: {
            findByPublicId: async () => ({ publicId: 'target' }),
            updatePassword: async () => {
              operations.push('password');
              return true;
            },
          } as never,
          sessions: { revokeForUser: async () => (operations.push('sessions'), 2) } as never,
          challenges: { revokeForUser: async () => (operations.push('challenges'), 1) } as never,
          passwordResets: {
            record: async () => {
              operations.push('evidence');
            },
          },
          securityEvents: {
            append: async () => {
              operations.push('event');
            },
          },
        }),
      ),
      passwordHasher: { hash: async () => 'temporary-hash' } as never,
      tokenGenerator: { generateTemporaryPassword: () => 'ABCDEFGHJKLMNPQRSTUVWXYZ' } as never,
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    const result = await useCase.execute({
      actor: {
        userPublicId: 'actor',
        permissions: ['user.password.reset'],
      } as never,
      targetPublicId: 'target',
      reason: 'User cannot access the existing credential.',
      requestId: 'request-id',
    });

    expect(result.temporaryPassword).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ');
    expect(operations).toEqual(['password', 'sessions', 'challenges', 'evidence', 'event']);
  });
});
