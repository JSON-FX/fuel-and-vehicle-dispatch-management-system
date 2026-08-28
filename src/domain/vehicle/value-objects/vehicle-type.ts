import { DomainError } from '@/domain/shared/errors/domain-error';

export class VehicleType {
  private constructor(private readonly value: string) {}

  static from(value: string): VehicleType {
    const normalized = value.trim().replaceAll(/\s+/g, ' ');
    if (normalized.length < 1 || normalized.length > 100) {
      throw new DomainError(
        'INVALID_VEHICLE_TYPE',
        'Vehicle type must contain 1 to 100 characters.',
      );
    }
    return new VehicleType(normalized);
  }

  toString(): string {
    return this.value;
  }
}
