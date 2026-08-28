import { DomainError } from '@/domain/shared/errors/domain-error';

export class EmailAddress {
  private constructor(private readonly value: string) {}

  static from(value: string): EmailAddress {
    const normalized = value.trim().toLowerCase();

    if (
      normalized.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
      normalized.includes('..')
    ) {
      throw new DomainError('INVALID_EMAIL_ADDRESS', 'A valid email address is required.');
    }

    return new EmailAddress(normalized);
  }

  get localPart(): string {
    return this.value.slice(0, this.value.indexOf('@'));
  }

  toString(): string {
    return this.value;
  }
}
