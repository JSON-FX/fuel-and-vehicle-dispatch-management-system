import { describe, expect, it } from 'vitest';

import { UpdateRole } from '@/application/auth/use-cases/update-role';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from '../support/auth-fakes';

describe('UpdateRole', () => {
  it('revokes every affected user session after a role security change', async () => {
    const revoked: string[] = [];
    const useCase = new UpdateRole({
      transaction: new FakeAuthTransaction(
        authRepositories({
          roles: {
            findByPublicId: async () => ({
              publicId: 'role',
              code: 'VIEWER',
              isPrivileged: false,
              isActive: true,
            }),
            update: async () => true,
            userPublicIdsForRole: async () => ['user-1', 'user-2'],
          } as never,
          sessions: {
            revokeForUser: async (userPublicId: string) => {
              revoked.push(userPublicId);
              return 1;
            },
          } as never,
          securityEvents: { append: async () => undefined },
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await useCase.execute({
      actor: { userPublicId: 'actor', permissions: ['role.manage'] } as never,
      rolePublicId: 'role',
      name: 'Read-only users',
      isActive: false,
      requestId: 'request-id',
    });

    expect(revoked).toEqual(['user-1', 'user-2']);
  });
});
