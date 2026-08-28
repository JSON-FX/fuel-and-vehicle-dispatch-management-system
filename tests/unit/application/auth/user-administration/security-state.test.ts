import { describe, expect, it, vi } from 'vitest';

import { AssignUserRoles } from '@/application/auth/use-cases/assign-user-roles';
import { SoftDeleteUser } from '@/application/auth/use-cases/soft-delete-user';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
  TEST_ACTOR_PUBLIC_ID,
  TEST_ROLE_PUBLIC_ID,
  TEST_TARGET_PUBLIC_ID,
} from '../support/auth-fakes';

describe('user administration security state', () => {
  const now = new Date('2026-08-28T00:00:00.000Z');
  const softDelete = (overrides = {}) =>
    new SoftDeleteUser({
      transaction: new FakeAuthTransaction(authRepositories(overrides)),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => now },
    });

  it('prevents an actor from deleting their own account', async () => {
    const useCase = new SoftDeleteUser({
      transaction: new FakeAuthTransaction(authRepositories()),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date() },
    });

    await expect(
      useCase.execute({
        actor: { userPublicId: 'same', permissions: ['user.manage'] } as never,
        targetPublicId: 'same',
        reason: 'Administrative lifecycle change.',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('requires user.manage and a specific deletion reason', async () => {
    const base = {
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      requestId: 'request-id',
      reason: 'Administrative lifecycle change.',
    };
    await expect(
      softDelete().execute({
        ...base,
        actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: [] } as never,
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
    await expect(
      softDelete().execute({
        ...base,
        actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.manage'] } as never,
        reason: 'too short',
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('returns not found for an unknown deletion target', async () => {
    await expect(
      softDelete({ users: { findByPublicId: vi.fn().mockResolvedValue(null) } as never }).execute({
        actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.manage'] } as never,
        targetPublicId: 'missing',
        reason: 'Administrative lifecycle change.',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('protects the last active super administrator', async () => {
    await expect(
      softDelete({
        users: {
          findByPublicId: vi.fn().mockResolvedValue({ roles: ['SUPER_ADMIN'] }),
          countActiveUsersWithRole: vi.fn().mockResolvedValue(1),
        } as never,
      }).execute({
        actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.manage'] } as never,
        targetPublicId: TEST_TARGET_PUBLIC_ID,
        reason: 'Administrative lifecycle change.',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 422 });
  });

  it('soft-deletes a user and revokes every browser credential', async () => {
    const softDeleteUser = vi.fn().mockResolvedValue(true);
    const revokeSessions = vi.fn().mockResolvedValue(2);
    const revokeChallenges = vi.fn().mockResolvedValue(1);
    const append = vi.fn();
    await softDelete({
      users: {
        findByPublicId: vi.fn().mockResolvedValue({ roles: ['VIEWER'] }),
        softDelete: softDeleteUser,
      } as never,
      sessions: { revokeForUser: revokeSessions } as never,
      challenges: { revokeForUser: revokeChallenges } as never,
      auditEvents: { append } as never,
    }).execute({
      actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.manage'] } as never,
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      reason: ' Administrative lifecycle change. ',
      requestId: 'request-id',
    });

    expect(softDeleteUser).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now);
    expect(revokeSessions).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now, 'user_deleted');
    expect(revokeChallenges).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { reason: 'Administrative lifecycle change.' } }),
    );
  });

  it('returns not found when the delete loses a concurrent race', async () => {
    await expect(
      softDelete({
        users: {
          findByPublicId: vi.fn().mockResolvedValue({ roles: ['VIEWER'] }),
          softDelete: vi.fn().mockResolvedValue(false),
        } as never,
      }).execute({
        actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['user.manage'] } as never,
        targetPublicId: TEST_TARGET_PUBLIC_ID,
        reason: 'Administrative lifecycle change.',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('revokes sessions after replacing roles', async () => {
    const operations: string[] = [];
    const useCase = new AssignUserRoles({
      transaction: new FakeAuthTransaction(
        authRepositories({
          users: {
            findByPublicId: async () => ({
              publicId: TEST_TARGET_PUBLIC_ID,
              roles: ['VIEWER'],
            }),
            countActiveUsersWithRole: async () => 2,
          } as never,
          roles: {
            findByPublicIds: async () => [
              { publicId: TEST_ROLE_PUBLIC_ID, code: 'AUDITOR', isPrivileged: false },
            ],
            replaceUserRoles: async () => operations.push('roles'),
          } as never,
          sessions: { revokeForUser: async () => (operations.push('sessions'), 1) } as never,
          auditEvents: { append: async () => operations.push('event') } as never,
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    });

    await useCase.execute({
      actor: { userPublicId: TEST_ACTOR_PUBLIC_ID, permissions: ['role.manage'] } as never,
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      rolePublicIds: [TEST_ROLE_PUBLIC_ID],
      requestId: 'request-id',
    });

    expect(operations).toEqual(['roles', 'sessions', 'event']);
  });
});
