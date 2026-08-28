import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { AuthorizationPolicy } from '@/domain/user/policies/authorization-policy';
import { SessionPolicy } from '@/domain/user/policies/session-policy';
import { PermissionCode } from '@/domain/user/value-objects/permission-code';

describe('user policies', () => {
  it('selects the stricter privileged timeout and concurrency limit', () => {
    const policy = new SessionPolicy({
      standardIdleTimeoutSeconds: 1_800,
      privilegedIdleTimeoutSeconds: 900,
      privilegedSessionLimit: 1,
    });

    expect(policy.idleTimeoutSeconds(false)).toBe(1_800);
    expect(policy.idleTimeoutSeconds(true)).toBe(900);
    expect(policy.canCreatePrivilegedSession(0)).toBe(true);
    expect(policy.canCreatePrivilegedSession(1)).toBe(false);
  });

  it('requires an exact active permission code', () => {
    const policy = new AuthorizationPolicy();
    const permissions = new Set(['user.read']);

    expect(() =>
      policy.assertPermission(permissions, PermissionCode.from('user.read')),
    ).not.toThrow();
    expect(() => policy.assertPermission(permissions, PermissionCode.from('user.manage'))).toThrow(
      DomainError,
    );
  });

  it('prevents an administrator from changing their own security state', () => {
    const policy = new AuthorizationPolicy();

    expect(() => policy.assertDifferentActor('actor-public-id', 'actor-public-id')).toThrow(
      DomainError,
    );
    expect(() => policy.assertDifferentActor('actor-public-id', 'target-public-id')).not.toThrow();
  });
});
