import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import { PermissionCode } from '@/domain/user/value-objects/permission-code';
import { Username } from '@/domain/user/value-objects/username';

describe('identity value objects', () => {
  it('normalizes a username before validating it', () => {
    expect(Username.from('  Dispatch.Officer_1 ').toString()).toBe('dispatch.officer_1');
  });

  it.each(['ab', 'contains space', 'invalid!', 'a'.repeat(65)])(
    'rejects invalid username %s',
    (value) => {
      expect(() => Username.from(value)).toThrow(DomainError);
    },
  );

  it('normalizes an email address and exposes its local part', () => {
    const email = EmailAddress.from(' Admin.User@Example.LAN ');

    expect(email.toString()).toBe('admin.user@example.lan');
    expect(email.localPart).toBe('admin.user');
  });

  it('accepts stable lowercase permission codes', () => {
    expect(PermissionCode.from('user.password.reset').toString()).toBe('user.password.reset');
  });

  it.each(['User.Read', 'user read', 'user', '.user.read'])(
    'rejects invalid permission %s',
    (value) => {
      expect(() => PermissionCode.from(value)).toThrow(DomainError);
    },
  );
});
