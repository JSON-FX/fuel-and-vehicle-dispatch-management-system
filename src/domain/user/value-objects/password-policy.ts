import { DomainError } from '@/domain/shared/errors/domain-error';
import type { EmailAddress } from '@/domain/user/value-objects/email-address';
import type { Username } from '@/domain/user/value-objects/username';

export interface PasswordIdentity {
  readonly username: Username;
  readonly email: EmailAddress;
}

export class PasswordPolicy {
  constructor(
    private readonly minimumLength: number,
    private readonly maximumLength: number,
  ) {
    if (minimumLength < 1 || maximumLength < minimumLength) {
      throw new DomainError('INVALID_PASSWORD_POLICY', 'Password policy bounds are invalid.');
    }
  }

  assertEligible(password: string, identity: PasswordIdentity): void {
    const characterLength = Array.from(password).length;
    const comparable = password.normalize('NFKC').toLowerCase();

    if (
      characterLength < this.minimumLength ||
      characterLength > this.maximumLength ||
      /[\p{Cc}\p{Cf}]/u.test(password) ||
      comparable.includes(identity.username.toString()) ||
      comparable.includes(identity.email.localPart)
    ) {
      throw new DomainError('PASSWORD_POLICY_VIOLATION', 'The password does not meet policy.');
    }
  }
}
