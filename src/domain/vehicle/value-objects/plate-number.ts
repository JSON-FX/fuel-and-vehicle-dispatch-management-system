import { DomainError } from '@/domain/shared/errors/domain-error';

export class PlateNumber {
  private constructor(private readonly value: string) {}

  static from(value: string): PlateNumber {
    const normalized = value.trim().replaceAll(/\s+/g, ' ').toUpperCase();
    if (normalized.length < 1 || normalized.length > 30) {
      throw new DomainError(
        'INVALID_PLATE_NUMBER',
        'Plate number must contain 1 to 30 characters.',
      );
    }
    return new PlateNumber(normalized);
  }

  toString(): string {
    return this.value;
  }
}
