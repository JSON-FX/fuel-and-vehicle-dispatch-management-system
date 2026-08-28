import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';

const MAX_ODOMETER_READING = DecimalValue.from('99999999999.9');

export class OdometerReading {
  private constructor(private readonly value: DecimalValue) {}

  static from(value: unknown): OdometerReading {
    let decimal: DecimalValue;
    try {
      decimal = DecimalValue.from(value);
    } catch {
      throw OdometerReading.invalid();
    }

    if (
      decimal.isNegative() ||
      decimal.decimalPlaces() > 1 ||
      decimal.compare(MAX_ODOMETER_READING) > 0
    ) {
      throw OdometerReading.invalid();
    }

    return new OdometerReading(decimal);
  }

  isAtLeast(other: OdometerReading): boolean {
    return this.value.compare(other.value) >= 0;
  }

  assertAtLeast(other: OdometerReading): void {
    if (!this.isAtLeast(other)) {
      throw new DomainError(
        'FINAL_ODOMETER_BELOW_INITIAL',
        'Final odometer reading cannot be below the initial reading.',
      );
    }
  }

  distanceFrom(initial: OdometerReading): string {
    this.assertAtLeast(initial);
    return this.value.subtract(initial.value).toFixed(1);
  }

  toString(): string {
    return this.value.toFixed(1);
  }

  private static invalid(): DomainError {
    return new DomainError(
      'INVALID_ODOMETER_READING',
      'Odometer reading must be a nonnegative decimal with at most one decimal place.',
    );
  }
}
