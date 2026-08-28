import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import { PasswordPolicy } from '@/domain/user/value-objects/password-policy';
import { Username } from '@/domain/user/value-objects/username';

const policy = new PasswordPolicy(12, 128);
const identity = {
  username: Username.from('dispatch.officer'),
  email: EmailAddress.from('dispatch@example.lan'),
};

describe('PasswordPolicy', () => {
  it.each(['correct horse', 'a'.repeat(128), 'spaces and ünicode are valid'])(
    'accepts an eligible password',
    (password) => {
      expect(() => policy.assertEligible(password, identity)).not.toThrow();
    },
  );

  it.each(['short', 'a'.repeat(129), 'DISPATCH.officer-password', 'dispatch secure phrase'])(
    'rejects an ineligible password without storing it',
    (password) => {
      expect(() => policy.assertEligible(password, identity)).toThrow(DomainError);
    },
  );
});
