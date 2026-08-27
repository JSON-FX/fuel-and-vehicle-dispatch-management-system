import { DomainError } from '@/domain/shared/errors/domain-error';
import Decimal from 'decimal.js';

export class DecimalValue {
  private static readonly DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

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

  toString(): string {
    return this.value.isZero() ? '0' : this.value.toString();
  }
}
