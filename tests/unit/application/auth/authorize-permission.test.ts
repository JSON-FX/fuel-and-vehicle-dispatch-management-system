import { describe, expect, it } from 'vitest';

import { AuthorizePermission } from '@/application/auth/services/authorize-permission';

describe('AuthorizePermission', () => {
  it('requires an exact active permission', () => {
    const authorize = new AuthorizePermission();
    const principal = { permissions: ['user.read'] } as never;

    expect(() => authorize.execute(principal, 'user.read')).not.toThrow();
    expect(() => authorize.execute(principal, 'user.manage')).toThrowError(
      expect.objectContaining({ httpStatus: 403 }),
    );
  });
});
