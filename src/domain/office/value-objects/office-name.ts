import { DomainError } from '@/domain/shared/errors/domain-error';

export class OfficeName {
  private constructor(private readonly value: string) {}

  static from(value: string): OfficeName {
    const normalized = value.trim().replaceAll(/\s+/g, ' ');

    if (normalized.length < 1 || normalized.length > 150) {
      throw new DomainError('INVALID_OFFICE_NAME', 'Office name must contain 1 to 150 characters.');
    }

    return new OfficeName(normalized);
  }

  toString(): string {
    return this.value;
  }
}
