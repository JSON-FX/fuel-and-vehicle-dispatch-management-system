import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import type { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import type { UnitPrice } from '@/domain/fuel/value-objects/unit-price';

export class FuelTotal {
  private constructor(private readonly value: DecimalValue) {}

  static from(value: unknown): FuelTotal {
    const decimal = DecimalValue.from(value);
    if (!decimal.isPositive() || decimal.decimalPlaces() > 2) {
      throw new DomainError(
        'INVALID_FUEL_TOTAL',
        'Fuel total must be positive with at most two decimal places.',
      );
    }
    return new FuelTotal(decimal);
  }

  static calculate(quantity: FuelQuantity, unitPrice: UnitPrice): FuelTotal {
    return new FuelTotal(quantity.toDecimalValue().multiply(unitPrice.toDecimalValue()).round(2));
  }

  toString(): string {
    return this.value.toFixed(2);
  }
}
