import { describe, expect, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Permission } from '@/domain/user/entities/permission';
import { Role } from '@/domain/user/entities/role';
import { User } from '@/domain/user/entities/user';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import { PermissionCode } from '@/domain/user/value-objects/permission-code';
import { Username } from '@/domain/user/value-objects/username';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);

describe('identity entities', () => {
  it('keeps a soft-deleted user resolvable but ineligible for authentication', () => {
    const user = new User({
      publicId: publicId('000000000001'),
      username: Username.from('driver.admin'),
      email: EmailAddress.from('driver.admin@example.lan'),
      fullName: 'Driver Administrator',
      isActive: true,
      mustChangePassword: true,
      requiresMfa: false,
      deletedAt: null,
    });

    expect(user.canAuthenticate()).toBe(true);
    user.softDelete(new Date('2026-08-28T00:00:00.000Z'));
    expect(user.canAuthenticate()).toBe(false);
    expect(user.deletedAt?.toISOString()).toBe('2026-08-28T00:00:00.000Z');

    user.restore();
    expect(user.isActive).toBe(false);
    expect(user.deletedAt).toBeNull();
  });

  it('represents privileged and inactive roles explicitly', () => {
    const role = new Role({
      publicId: publicId('000000000002'),
      code: 'SYSTEM_ADMIN',
      name: 'System administrator',
      isPrivileged: true,
      isActive: true,
      isSystem: true,
    });

    expect(role.isPrivileged).toBe(true);
    role.deactivate();
    expect(role.isActive).toBe(false);
  });

  it('represents code-owned permissions without mutable codes', () => {
    const permission = new Permission({
      publicId: publicId('000000000003'),
      code: PermissionCode.from('user.read'),
      name: 'Read users',
      isActive: true,
    });

    expect(permission.code.toString()).toBe('user.read');
    permission.deactivate();
    expect(permission.isActive).toBe(false);
  });
});
