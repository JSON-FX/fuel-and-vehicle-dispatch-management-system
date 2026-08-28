import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';

export class FuelQuantity {
  private constructor(private readonly value: DecimalValue) {}

  static from(value: unknown): FuelQuantity {
    const decimal = DecimalValue.from(value);
    if (!decimal.isPositive() || decimal.decimalPlaces() > 3) {
      throw new DomainError(
        'INVALID_FUEL_QUANTITY',
        'Fuel quantity must be positive with at most three decimal places.',
      );
    }
    return new FuelQuantity(decimal);
  }

  toDecimalValue(): DecimalValue {
    return this.value;
  }

  negatedString(): string {
    return this.value.negate().toString();
  }

  toString(): string {
    return this.value.toString();
  }
}
