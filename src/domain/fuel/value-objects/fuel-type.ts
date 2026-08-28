import { DomainError } from '@/domain/shared/errors/domain-error';

export const FUEL_TYPES = ['DIESEL', 'GASOLINE'] as const;
export type FuelTypeValue = (typeof FUEL_TYPES)[number];

export class FuelType {
  private constructor(private readonly value: FuelTypeValue) {}

  static from(value: unknown): FuelType {
    if (!FUEL_TYPES.includes(value as FuelTypeValue)) {
      throw new DomainError('INVALID_FUEL_TYPE', 'Fuel type must be DIESEL or GASOLINE.');
    }
    return new FuelType(value as FuelTypeValue);
  }

  static diesel(): FuelType {
    return new FuelType('DIESEL');
  }

  static gasoline(): FuelType {
    return new FuelType('GASOLINE');
  }

  toString(): FuelTypeValue {
    return this.value;
  }
}
