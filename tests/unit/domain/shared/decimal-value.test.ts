import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';

describe('DecimalValue', () => {
  it('multiplies decimal values without binary floating-point loss', () => {
    const left = DecimalValue.from('0.1');
    const right = DecimalValue.from('0.2');

    expect(left.multiply(right).toString()).toBe('0.02');
    expect(left.toString()).toBe('0.1');
    expect(right.toString()).toBe('0.2');
  });

  it('adds, subtracts, negates, compares, and rounds without number coercion', () => {
    const left = DecimalValue.from('10.005');
    const right = DecimalValue.from('0.005');

    expect(left.add(right).toString()).toBe('10.01');
    expect(left.subtract(right).toString()).toBe('10');
    expect(right.negate().toString()).toBe('-0.005');
    expect(left.compare(right)).toBe(1);
    expect(left.equals(DecimalValue.from('10.005'))).toBe(true);
    expect(left.round(2).toFixed(2)).toBe('10.01');
    expect(left.decimalPlaces()).toBe(3);
    expect(left.isPositive()).toBe(true);
  });

  it.each([0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects JavaScript number input %s',
    (value) => {
      expect(() => DecimalValue.from(value)).toThrow(DomainError);
    },
  );

  it.each(['', ' ', 'NaN', 'Infinity', '1.2.3', ' 1.20 ', '1e3', '.'])(
    'rejects malformed decimal input %j',
    (value) => {
      expect(() => DecimalValue.from(value)).toThrow(DomainError);
    },
  );

  it.each([
    ['001.2300', '1.23'],
    ['-0', '0'],
    ['100', '100'],
  ])('serializes %s to canonical form %s', (input, expected) => {
    expect(DecimalValue.from(input).toString()).toBe(expected);
  });
});
