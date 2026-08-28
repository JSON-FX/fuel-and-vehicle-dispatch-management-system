import { describe, expect, it } from 'vitest';

import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const input = {
  publicId: publicId('000000000321'),
  fuelIssuancePublicId: publicId('000000000322'),
  fuelType: FuelType.diesel(),
  quantity: FuelQuantity.from('30.125'),
  effectiveDate: EntryDate.from('2026-08-28'),
  reference: '2026-08-001',
  createdAt: new Date('2026-08-28T02:00:00.000Z'),
};

describe('FuelLedgerEntry', () => {
  it('creates one negative issuance entry from a posted quantity', () => {
    const entry = FuelLedgerEntry.issuance(input);

    expect(entry.transactionType).toBe('ISSUANCE');
    expect(entry.quantity.toString()).toBe('30.125');
    expect(entry.signedQuantity.toString()).toBe('-30.125');
    expect(entry.effectiveDate.toString()).toBe('2026-08-28');
  });

  it('creates one positive adjustment for a void compensation', () => {
    const entry = FuelLedgerEntry.voidCompensation({
      ...input,
      publicId: publicId('000000000323'),
    });

    expect(entry.transactionType).toBe('ADJUSTMENT');
    expect(entry.signedQuantity.toString()).toBe('30.125');
  });

  it('reconstructs supported source types while enforcing sign and absolute quantity', () => {
    expect(
      new FuelLedgerEntry({
        ...input,
        fuelIssuancePublicId: null,
        transactionType: 'RECEIPT',
        signedQuantity: DecimalValue.from('30.125'),
      }).transactionType,
    ).toBe('RECEIPT');

    expect(
      () =>
        new FuelLedgerEntry({
          ...input,
          transactionType: 'ISSUANCE',
          signedQuantity: DecimalValue.from('30.125'),
        }),
    ).toThrow(DomainError);
    expect(
      () =>
        new FuelLedgerEntry({
          ...input,
          transactionType: 'ADJUSTMENT',
          signedQuantity: DecimalValue.from('-1'),
        }),
    ).toThrow(DomainError);
  });
});
