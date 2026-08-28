import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';

export class UnitPrice {
  private constructor(private readonly value: DecimalValue) {}

  static from(value: unknown): UnitPrice {
    const decimal = DecimalValue.from(value);
    if (!decimal.isPositive() || decimal.decimalPlaces() > 2) {
      throw new DomainError(
        'INVALID_FUEL_UNIT_PRICE',
        'Unit price must be positive with at most two decimal places.',
      );
    }
    return new UnitPrice(decimal);
  }

  toDecimalValue(): DecimalValue {
    return this.value;
  }

  toString(): string {
    return this.value.toFixed(2);
  }
}
