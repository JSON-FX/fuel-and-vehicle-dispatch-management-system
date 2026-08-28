import { DomainError } from '@/domain/shared/errors/domain-error';

export class DriverContactNumber {
  private constructor(private readonly value: string) {}

  static optional(value: string | null | undefined): DriverContactNumber | null {
    const normalized = value?.trim().replaceAll(/\s+/g, ' ') ?? '';
    if (normalized.length === 0) return null;

    if (normalized.length > 50) {
      throw new DomainError(
        'INVALID_DRIVER_CONTACT_NUMBER',
        'Driver contact number must contain at most 50 characters.',
      );
    }

    return new DriverContactNumber(normalized);
  }

  toString(): string {
    return this.value;
  }
}
