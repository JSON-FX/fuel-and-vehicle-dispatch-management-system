import { describe, expect, it } from 'vitest';

import { UpdateRole } from '@/application/auth/use-cases/update-role';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
  TEST_ACTOR_PUBLIC_ID,
  TEST_ROLE_PUBLIC_ID,
} from '../support/auth-fakes';

describe('UpdateRole', () => {
  it('revokes every affected user session after a role security change', async () => {
    const revoked: string[] = [];
    const useCase = new UpdateRole({
      transaction: new FakeAuthTransaction(
        authRepositories({
          roles: {
            findByPublicId: async () => ({
              publicId: TEST_ROLE_PUBLIC_ID,
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
          auditEvents: { append: async () => undefined },
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await useCase.execute({
      actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['role.manage'] } as never,
      rolePublicId: TEST_ROLE_PUBLIC_ID,
      name: 'Read-only users',
      isActive: false,
      requestId: 'request-id',
    });

    expect(revoked).toEqual(['user-1', 'user-2']);
  });
});
