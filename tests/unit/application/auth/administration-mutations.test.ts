import { describe, expect, it, vi } from 'vitest';

import { AssignRolePermissions } from '@/application/auth/use-cases/assign-role-permissions';
import { CreateRole } from '@/application/auth/use-cases/create-role';
import { RestoreUser } from '@/application/auth/use-cases/restore-user';
import { RevokeUserSessions } from '@/application/auth/use-cases/revoke-user-sessions';
import { UpdateUser } from '@/application/auth/use-cases/update-user';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
  TEST_ACTOR_PUBLIC_ID,
  TEST_ROLE_PUBLIC_ID,
  TEST_TARGET_PUBLIC_ID,
} from './support/auth-fakes';

const now = new Date('2026-08-28T00:00:00.000Z');
const actor = (permissions: readonly string[], userPublicId = TEST_ACTOR_PUBLIC_ID) =>
  ({ userPublicId, permissions }) as never;
const dependencies = (overrides = {}) => ({
  transaction: new FakeAuthTransaction(authRepositories(overrides)),
  publicIds: new SequencePublicIdGenerator(),
  clock: { now: () => now },
});

describe('administration mutations', () => {
  it('updates identity, revokes sessions for status changes, and records the event', async () => {
    const updateIdentity = vi.fn().mockResolvedValue(true);
    const revokeForUser = vi.fn().mockResolvedValue(2);
    const append = vi.fn().mockResolvedValue(undefined);
    const useCase = new UpdateUser(
      dependencies({
        users: { updateIdentity } as never,
        sessions: { revokeForUser } as never,
        auditEvents: { append } as never,
      }),
    );

    await useCase.execute({
      actor: actor(['user.manage']),
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      email: ' DISPATCHER@EXAMPLE.LAN ',
      fullName: ' Dispatch Operator ',
      isActive: false,
      requestId: 'request-id',
    });

    expect(updateIdentity).toHaveBeenCalledWith({
      publicId: TEST_TARGET_PUBLIC_ID,
      email: 'dispatcher@example.lan',
      fullName: 'Dispatch Operator',
      isActive: false,
      updatedAt: now,
    });
    expect(revokeForUser).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now, 'status_changed');
    expect(append).toHaveBeenCalledOnce();
  });

  it('updates profile fields without revoking sessions', async () => {
    const revokeForUser = vi.fn();
    const useCase = new UpdateUser(
      dependencies({
        users: { updateIdentity: vi.fn().mockResolvedValue(true) } as never,
        sessions: { revokeForUser } as never,
        auditEvents: { append: vi.fn() } as never,
      }),
    );

    await useCase.execute({
      actor: actor(['user.manage']),
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      fullName: 'New Name',
      requestId: 'request-id',
    });

    expect(revokeForUser).not.toHaveBeenCalled();
  });

  it('rejects denied, self-status, missing, and malformed-email updates', async () => {
    const useCase = new UpdateUser(
      dependencies({ users: { updateIdentity: vi.fn().mockResolvedValue(false) } as never }),
    );
    const base = { targetPublicId: TEST_TARGET_PUBLIC_ID, requestId: 'request-id' };

    await expect(useCase.execute({ ...base, actor: actor([]) })).rejects.toMatchObject({
      httpStatus: 403,
    });
    await expect(
      useCase.execute({
        ...base,
        actor: actor(['user.manage'], TEST_TARGET_PUBLIC_ID),
        isActive: false,
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
    await expect(
      useCase.execute({ ...base, actor: actor(['user.manage']), fullName: 'Missing' }),
    ).rejects.toMatchObject({ httpStatus: 404 });
    await expect(
      useCase.execute({ ...base, actor: actor(['user.manage']), email: 'invalid' }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL_ADDRESS' });
  });

  it('restores an inactive user and records the event', async () => {
    const restoreInactive = vi.fn().mockResolvedValue(true);
    const append = vi.fn();
    await new RestoreUser(
      dependencies({ users: { restoreInactive } as never, auditEvents: { append } as never }),
    ).execute({
      actor: actor(['user.manage']),
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      requestId: 'request-id',
    });

    expect(restoreInactive).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now);
    expect(append).toHaveBeenCalledOnce();
  });

  it('rejects denied and missing restores', async () => {
    const useCase = new RestoreUser(
      dependencies({ users: { restoreInactive: vi.fn().mockResolvedValue(false) } as never }),
    );
    await expect(
      useCase.execute({
        actor: actor([]),
        targetPublicId: TEST_TARGET_PUBLIC_ID,
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
    await expect(
      useCase.execute({
        actor: actor(['user.manage']),
        targetPublicId: TEST_TARGET_PUBLIC_ID,
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('revokes all target sessions with operator evidence', async () => {
    const revokeForUser = vi.fn().mockResolvedValue(3);
    const append = vi.fn();
    const result = await new RevokeUserSessions(
      dependencies({ sessions: { revokeForUser } as never, auditEvents: { append } as never }),
    ).execute({
      actor: actor(['user.session.revoke']),
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      requestId: 'request-id',
      reason: 'operator_request',
    });

    expect(result).toBe(3);
    expect(revokeForUser).toHaveBeenCalledWith(TEST_TARGET_PUBLIC_ID, now, 'operator_request');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ count: 3 }) }),
    );
  });

  it('denies session revocation without permission', async () => {
    await expect(
      new RevokeUserSessions(dependencies()).execute({
        actor: actor([]),
        targetPublicId: TEST_TARGET_PUBLIC_ID,
        requestId: 'request-id',
        reason: 'operator_request',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('revokes one owned session and rejects a foreign session public ID', async () => {
    const revoke = vi.fn().mockResolvedValue(true);
    const listForUser = vi
      .fn()
      .mockResolvedValueOnce([{ publicId: 'session-public-id' }])
      .mockResolvedValueOnce([]);
    const useCase = new RevokeUserSessions(
      dependencies({
        sessions: { listForUser, revoke } as never,
        auditEvents: { append: vi.fn() } as never,
      }),
    );
    const input = {
      actor: actor(['user.session.revoke']),
      targetPublicId: TEST_TARGET_PUBLIC_ID,
      sessionPublicId: 'session-public-id',
      requestId: 'request-id',
      reason: 'operator_request',
    };

    await expect(useCase.execute(input)).resolves.toBe(1);
    expect(revoke).toHaveBeenCalledWith('session-public-id', now, 'operator_request');
    await expect(useCase.execute(input)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('creates normalized custom roles and assigns permissions', async () => {
    const create = vi.fn();
    const replaceRolePermissions = vi.fn();
    const result = await new CreateRole(
      dependencies({
        roles: { create } as never,
        permissions: { replaceRolePermissions } as never,
        auditEvents: { append: vi.fn() } as never,
      }),
    ).execute({
      actor: actor(['role.manage']),
      name: ' Fleet Reviewer ',
      isPrivileged: false,
      permissionPublicIds: ['permission'],
      requestId: 'request-id',
    });

    expect(result).toMatch(/^01900000-/);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ code: 'CUSTOM_FLEET_REVIEWER' }));
    expect(replaceRolePermissions).toHaveBeenCalledWith(result, ['permission'], now);
  });

  it('enforces role permissions, privileged elevation, and name bounds', async () => {
    const useCase = new CreateRole(dependencies());
    const base = {
      name: 'Reviewer',
      isPrivileged: false,
      permissionPublicIds: [] as string[],
      requestId: 'request-id',
    };
    await expect(useCase.execute({ ...base, actor: actor([]) })).rejects.toMatchObject({
      httpStatus: 403,
    });
    await expect(
      useCase.execute({ ...base, actor: actor(['role.manage']), isPrivileged: true }),
    ).rejects.toMatchObject({ httpStatus: 403 });
    await expect(
      useCase.execute({ ...base, actor: actor(['role.manage']), name: 'x' }),
    ).rejects.toMatchObject({ httpStatus: 400 });
    await expect(
      useCase.execute({ ...base, actor: actor(['role.manage']), name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('replaces role permissions and revokes every affected session', async () => {
    const replaceRolePermissions = vi.fn();
    const revokeForUser = vi.fn().mockResolvedValue(1);
    const append = vi.fn();
    await new AssignRolePermissions(
      dependencies({
        roles: {
          findByPublicId: vi.fn().mockResolvedValue({ publicId: TEST_ROLE_PUBLIC_ID }),
          userPublicIdsForRole: vi.fn().mockResolvedValue(['user-1', 'user-2']),
        } as never,
        permissions: { replaceRolePermissions } as never,
        sessions: { revokeForUser } as never,
        auditEvents: { append } as never,
      }),
    ).execute({
      actor: actor(['role.manage']),
      rolePublicId: TEST_ROLE_PUBLIC_ID,
      permissionPublicIds: ['permission'],
      requestId: 'request-id',
    });

    expect(replaceRolePermissions).toHaveBeenCalledWith(TEST_ROLE_PUBLIC_ID, ['permission'], now);
    expect(revokeForUser).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenCalledOnce();
  });

  it('rejects denied and missing role permission replacements', async () => {
    const useCase = new AssignRolePermissions(
      dependencies({ roles: { findByPublicId: vi.fn().mockResolvedValue(null) } as never }),
    );
    const base = { rolePublicId: 'role', permissionPublicIds: [], requestId: 'request-id' };
    await expect(useCase.execute({ ...base, actor: actor([]) })).rejects.toMatchObject({
      httpStatus: 403,
    });
    await expect(useCase.execute({ ...base, actor: actor(['role.manage']) })).rejects.toMatchObject(
      {
        httpStatus: 404,
      },
    );
  });
});
