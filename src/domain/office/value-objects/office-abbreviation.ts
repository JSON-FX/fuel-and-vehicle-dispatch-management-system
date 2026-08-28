import { DomainError } from '@/domain/shared/errors/domain-error';

export class OfficeAbbreviation {
  private constructor(private readonly value: string) {}

  static from(value: string): OfficeAbbreviation {
    const normalized = value.trim().replaceAll(/\s+/g, ' ').toUpperCase();

    if (normalized.length < 1 || normalized.length > 30) {
      throw new DomainError(
        'INVALID_OFFICE_ABBREVIATION',
        'Office abbreviation must contain 1 to 30 characters.',
      );
    }

    return new OfficeAbbreviation(normalized);
  }

  toString(): string {
    return this.value;
  }
}
