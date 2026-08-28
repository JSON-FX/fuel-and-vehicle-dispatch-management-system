import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { AuditAction } from '@/domain/audit/value-objects/audit-action';

describe('AuditAction', () => {
  it('normalizes a bounded dotted action', () => {
    expect(AuditAction.from('  AUTH.Login.Failed  ').toString()).toBe('auth.login.failed');
  });

  it.each([
    '',
    'login',
    '.auth.login',
    'auth..login',
    'auth login.failed',
    'auth.login-failed',
    `auth.${'a'.repeat(96)}`,
  ])('rejects an invalid action %j', (action) => {
    expect(() => AuditAction.from(action)).toThrow(DomainError);
  });
});
