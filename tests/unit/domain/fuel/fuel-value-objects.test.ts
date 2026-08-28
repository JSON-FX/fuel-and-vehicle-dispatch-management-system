import { describe, expect, it } from 'vitest';

import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelIssuanceStatus } from '@/domain/fuel/value-objects/fuel-issuance-status';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { DomainError } from '@/domain/shared/errors/domain-error';

describe('fuel value objects', () => {
  it('keeps valid civil dates stable and derives the Manila effective instant', () => {
    const entryDate = EntryDate.from('2028-02-29');

    expect(entryDate.toString()).toBe('2028-02-29');
    expect(entryDate.year).toBe(2028);
    expect(entryDate.month).toBe(2);
    expect(entryDate.toEffectiveInstant().toISOString()).toBe('2028-02-28T16:00:00.000Z');
  });

  it.each(['2026-02-29', '2026-13-01', '2026-01-00', '2026-1-1', 20260101])(
    'rejects invalid civil date %j',
    (value) => {
      expect(() => EntryDate.from(value)).toThrow(DomainError);
    },
  );

  it('accepts positive quantities with at most three decimal places', () => {
    expect(FuelQuantity.from('12.345').toString()).toBe('12.345');
    expect(FuelQuantity.from('12.300').toString()).toBe('12.3');
    expect(FuelQuantity.from('0.001').negatedString()).toBe('-0.001');
  });

  it.each(['0', '-1', '1.0001', '1e2', ' 1.2 ', 1.2])(
    'rejects invalid fuel quantity %j',
    (value) => {
      expect(() => FuelQuantity.from(value)).toThrow(DomainError);
    },
  );

  it('keeps unit price at two input decimals and calculates one rounded total', () => {
    const quantity = FuelQuantity.from('1.005');
    const unitPrice = UnitPrice.from('10.01');

    expect(unitPrice.toString()).toBe('10.01');
    expect(FuelTotal.calculate(quantity, unitPrice).toString()).toBe('10.06');
    expect(FuelTotal.from('10.60').toString()).toBe('10.60');
  });

  it.each(['0', '-0.01', '10.001', '1e2', 10])('rejects invalid unit price %j', (value) => {
    expect(() => UnitPrice.from(value)).toThrow(DomainError);
  });

  it('formats RIS values with a minimum three-digit monthly sequence', () => {
    const date = EntryDate.from('2026-08-31');

    expect(RisNumber.issue(date, 1).toString()).toBe('2026-08-001');
    expect(RisNumber.issue(date, 999).toString()).toBe('2026-08-999');
    expect(RisNumber.issue(date, 1_000).toString()).toBe('2026-08-1000');
    expect(RisNumber.from('2026-08-001').sequence).toBe(1);
  });

  it.each([0, -1, 1.2, Number.NaN])('rejects invalid RIS sequence %j', (sequence) => {
    expect(() => RisNumber.issue(EntryDate.from('2026-08-01'), sequence)).toThrow(DomainError);
  });

  it.each(['2026-00-001', '2026-08-01', '2026-08-000', 'RIS-1'])(
    'rejects invalid RIS value %j',
    (value) => {
      expect(() => RisNumber.from(value)).toThrow(DomainError);
    },
  );

  it('normalizes purchase request identifiers without changing punctuation', () => {
    expect(PurchaseRequestNumber.from('  PR-2026 / 001  ').toString()).toBe('PR-2026 / 001');
  });

  it('represents only the initial fuel types and issuance states', () => {
    expect(FuelType.from('DIESEL').toString()).toBe('DIESEL');
    expect(FuelType.gasoline().toString()).toBe('GASOLINE');
    expect(FuelIssuanceStatus.draft().isDraft()).toBe(true);
    expect(FuelIssuanceStatus.posted().isPosted()).toBe(true);
    expect(FuelIssuanceStatus.voided().isVoided()).toBe(true);
    expect(() => FuelType.from('KEROSENE')).toThrow(DomainError);
    expect(() => FuelIssuanceStatus.from('CANCELLED')).toThrow(DomainError);
  });
});
