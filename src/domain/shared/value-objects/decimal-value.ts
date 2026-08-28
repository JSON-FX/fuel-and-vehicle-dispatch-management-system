import { DomainError } from '@/domain/shared/errors/domain-error';
import Decimal from 'decimal.js';

export class DecimalValue {
  private static readonly DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

  private constructor(private readonly value: Decimal) {}

  static from(value: unknown): DecimalValue {
    if (typeof value !== 'string' || !DecimalValue.DECIMAL_PATTERN.test(value)) {
      throw new DomainError('INVALID_DECIMAL', 'A finite decimal string is required.');
    }

    const decimal = new Decimal(value);
    if (!decimal.isFinite()) {
      throw new DomainError('INVALID_DECIMAL', 'A finite decimal string is required.');
    }

    return new DecimalValue(decimal);
  }

  multiply(other: DecimalValue): DecimalValue {
    return new DecimalValue(this.value.mul(other.value));
  }

  add(other: DecimalValue): DecimalValue {
    return new DecimalValue(this.value.add(other.value));
  }

  subtract(other: DecimalValue): DecimalValue {
    return new DecimalValue(this.value.sub(other.value));
  }

  negate(): DecimalValue {
    return new DecimalValue(this.value.negated());
  }

  absolute(): DecimalValue {
    return new DecimalValue(this.value.absoluteValue());
  }

  round(decimalPlaces: number, rounding: Decimal.Rounding = Decimal.ROUND_HALF_UP): DecimalValue {
    return new DecimalValue(this.value.toDecimalPlaces(decimalPlaces, rounding));
  }

  compare(other: DecimalValue): number {
    return this.value.comparedTo(other.value);
  }

  equals(other: DecimalValue): boolean {
    return this.value.equals(other.value);
  }

  isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  isNegative(): boolean {
    return this.value.isNegative() && !this.value.isZero();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  decimalPlaces(): number {
    return this.value.decimalPlaces();
  }

  toFixed(decimalPlaces: number): string {
    return this.value.toFixed(decimalPlaces);
  }

  toString(): string {
    return this.value.isZero() ? '0' : this.value.toString();
  }
}
