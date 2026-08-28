import { DomainError } from '@/domain/shared/errors/domain-error';

export class DriverName {
  private constructor(private readonly value: string) {}

  static from(value: string): DriverName {
    const normalized = value.trim().replaceAll(/\s+/g, ' ');

    if (normalized.length < 1 || normalized.length > 150) {
      throw new DomainError('INVALID_DRIVER_NAME', 'Driver name must contain 1 to 150 characters.');
    }

    return new DriverName(normalized);
  }

  toString(): string {
    return this.value;
  }
}
