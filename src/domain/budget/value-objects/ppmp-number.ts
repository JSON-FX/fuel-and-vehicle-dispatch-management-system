import { DomainError } from '@/domain/shared/errors/domain-error';

export class PpmpNumber {
  private constructor(private readonly value: string) {}

  static from(value: string): PpmpNumber {
    const normalized = value.trim().replaceAll(/\s+/g, ' ').toUpperCase();

    if (normalized.length < 1 || normalized.length > 80) {
      throw new DomainError('INVALID_PPMP_NUMBER', 'PPMP number must contain 1 to 80 characters.');
    }

    return new PpmpNumber(normalized);
  }

  toString(): string {
    return this.value;
  }
}
