import { describe, expect, it } from 'vitest';

import { ChangePassword } from '@/application/auth/use-cases/change-password';
import { PasswordPolicy } from '@/domain/user/value-objects/password-policy';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from './support/auth-fakes';

describe('ChangePassword', () => {
  it('updates the hash and revokes existing sessions and challenges atomically', async () => {
    const operations: string[] = [];
    const user = {
      publicId: '01900000-0000-7000-8000-000000000100',
      username: 'dispatch.officer',
      email: 'dispatch@example.lan',
      fullName: 'Dispatch Officer',
      passwordHash: 'old-hash',
      isActive: true,
      mustChangePassword: true,
      deletedAt: null,
      roles: [],
      permissions: [],
      isPrivileged: false,
      mfaEnrolled: false,
    };
    const useCase = new ChangePassword({
      transaction: new FakeAuthTransaction(
        authRepositories({
          users: {
            findByPublicId: async () => user,
            updatePassword: async () => {
              operations.push('password');
              return true;
            },
          } as never,
          sessions: {
            revokeForUser: async () => {
              operations.push('sessions');
              return 1;
            },
          } as never,
          challenges: {
            revokeForUser: async () => {
              operations.push('challenges');
              return 1;
            },
          } as never,
          auditEvents: {
            append: async () => {
              operations.push('event');
            },
          },
        }),
      ),
      passwordHasher: { hash: async () => 'new-hash' } as never,
      passwordPolicy: new PasswordPolicy(12, 128),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await useCase.execute({
      userPublicId: user.publicId,
      newPassword: 'correct horse battery staple',
      requestId: 'request-id',
    });

    expect(operations).toEqual(['password', 'sessions', 'challenges', 'event']);
  });
});
