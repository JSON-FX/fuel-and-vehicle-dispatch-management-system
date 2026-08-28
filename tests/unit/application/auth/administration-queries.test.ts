import { describe, expect, it, vi } from 'vitest';

import { GetRole } from '@/application/auth/use-cases/get-role';
import { GetUser } from '@/application/auth/use-cases/get-user';
import { ListPermissions } from '@/application/auth/use-cases/list-permissions';
import { ListRoles } from '@/application/auth/use-cases/list-roles';
import { ListUsers } from '@/application/auth/use-cases/list-users';

const actor = (permissions: readonly string[]) =>
  ({
    userPublicId: 'actor',
    username: 'administrator',
    fullName: 'Administrator',
    roles: ['SYSTEM_ADMIN'],
    permissions,
    isPrivileged: true,
    mustChangePassword: false,
    mfaEnrolled: true,
  }) as const;

const user = {
  publicId: 'user-public-id',
  username: 'dispatcher',
  email: 'dispatcher@example.lan',
  fullName: 'Dispatch Operator',
  passwordHash: 'must-never-leave-the-application',
  isActive: true,
  mustChangePassword: false,
  deletedAt: null,
  roles: ['DISPATCHER'],
  permissions: ['dispatch.read'],
  isPrivileged: false,
  mfaEnrolled: false,
};

const role = {
  publicId: 'role-public-id',
  code: 'DISPATCHER',
  name: 'Dispatcher',
  isPrivileged: false,
  isActive: true,
  isSystem: true,
  permissions: ['dispatch.read'],
};

describe('administration queries', () => {
  it('maps paginated users without exposing credential fields', async () => {
    const list = vi.fn().mockResolvedValue({ users: [user], total: 1 });

    const result = await new ListUsers({ list } as never).execute({
      actor: actor(['user.read']),
      page: 2,
      pageSize: 10,
      query: 'dispatch',
    });

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, query: 'dispatch' }),
    );
    expect(result).toEqual({
      items: [
        {
          publicId: user.publicId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          isActive: true,
          isDeleted: false,
          mustChangePassword: false,
          mfaEnrolled: false,
          roles: ['DISPATCHER'],
        },
      ],
      page: 2,
      pageSize: 10,
      total: 1,
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it.each([
    { page: 0, pageSize: 10 },
    { page: 1, pageSize: 0 },
    { page: 1, pageSize: 101 },
  ])('rejects invalid pagination: %o', async ({ page, pageSize }) => {
    await expect(
      new ListUsers({} as never).execute({
        actor: actor(['user.read']),
        page,
        pageSize,
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('denies user listings without user.read', async () => {
    await expect(
      new ListUsers({} as never).execute({ actor: actor([]), page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('returns a secret-free user detail', async () => {
    const result = await new GetUser({
      findByPublicId: vi.fn().mockResolvedValue(user),
    } as never).execute(actor(['user.read']), user.publicId);

    expect(result).toMatchObject({ publicId: user.publicId, isDeleted: false });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns not found and authorization errors for user detail', async () => {
    const useCase = new GetUser({ findByPublicId: vi.fn().mockResolvedValue(null) } as never);
    await expect(useCase.execute(actor(['user.read']), 'missing')).rejects.toMatchObject({
      httpStatus: 404,
    });
    await expect(useCase.execute(actor([]), 'missing')).rejects.toMatchObject({ httpStatus: 403 });
  });

  it('lists roles and permissions for an authorized actor', async () => {
    const permission = {
      publicId: 'permission-public-id',
      code: 'dispatch.read',
      name: 'Read dispatches',
      isActive: true,
    };
    await expect(
      new ListRoles({ list: vi.fn().mockResolvedValue([role]) } as never).execute(
        actor(['role.read']),
      ),
    ).resolves.toEqual([role]);
    await expect(
      new ListPermissions({ list: vi.fn().mockResolvedValue([permission]) } as never).execute(
        actor(['role.read']),
      ),
    ).resolves.toEqual([permission]);
  });

  it('denies role and permission listings without role.read', () => {
    expect(() => new ListRoles({} as never).execute(actor([]))).toThrowError(
      expect.objectContaining({ httpStatus: 403 }),
    );
    expect(() => new ListPermissions({} as never).execute(actor([]))).toThrowError(
      expect.objectContaining({ httpStatus: 403 }),
    );
  });

  it('returns one role and handles missing and denied requests', async () => {
    const findByPublicId = vi.fn().mockResolvedValueOnce(role).mockResolvedValueOnce(null);
    const useCase = new GetRole({ findByPublicId } as never);

    await expect(useCase.execute(actor(['role.read']), role.publicId)).resolves.toEqual(role);
    await expect(useCase.execute(actor(['role.read']), 'missing')).rejects.toMatchObject({
      httpStatus: 404,
    });
    await expect(useCase.execute(actor([]), role.publicId)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });
});
