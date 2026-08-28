import { describe, expect, it } from 'vitest';

import { CreateUser } from '@/application/auth/use-cases/create-user';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from '../support/auth-fakes';

describe('CreateUser', () => {
  it('creates an inactive-secret-free account result and returns the temporary password once', async () => {
    const operations: string[] = [];
    const useCase = new CreateUser({
      transaction: new FakeAuthTransaction(
        authRepositories({
          roles: {
            findByPublicIds: async () => [
              { publicId: 'role', code: 'VIEWER', isPrivileged: false },
            ],
            replaceUserRoles: async () => {
              operations.push('roles');
            },
          } as never,
          users: {
            create: async () => {
              operations.push('user');
            },
          } as never,
          securityEvents: { append: async () => undefined },
        }),
      ),
      passwordHasher: { hash: async () => 'temporary-hash' } as never,
      tokenGenerator: { generateTemporaryPassword: () => 'ABCDEFGHJKLMNPQRSTUVWXYZ' } as never,
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    const result = await useCase.execute({
      actor: { userPublicId: 'actor', permissions: ['user.manage'] } as never,
      username: 'new.viewer',
      email: 'new.viewer@example.lan',
      fullName: 'New Viewer',
      rolePublicIds: ['role'],
      requestId: 'request-id',
    });

    expect(result.temporaryPassword).toBe('ABCDEFGHJKLMNPQRSTUVWXYZ');
    expect(operations).toEqual(['user', 'roles']);
  });

  it('requires privileged assignment permission for a privileged role', async () => {
    const useCase = new CreateUser({
      transaction: new FakeAuthTransaction(
        authRepositories({
          roles: {
            findByPublicIds: async () => [
              { publicId: 'role', code: 'SYSTEM_ADMIN', isPrivileged: true },
            ],
          } as never,
        }),
      ),
      passwordHasher: {} as never,
      tokenGenerator: {} as never,
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date() },
    });

    await expect(
      useCase.execute({
        actor: { userPublicId: 'actor', permissions: ['user.manage'] } as never,
        username: 'system.admin',
        email: 'system.admin@example.lan',
        fullName: 'System Admin',
        rolePublicIds: ['role'],
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});
