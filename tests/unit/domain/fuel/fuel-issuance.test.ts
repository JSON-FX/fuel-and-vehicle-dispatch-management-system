import { describe, expect, it } from 'vitest';

import { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const publicId = (suffix: string) => PublicId.from(`01900000-0000-7000-8000-${suffix}`);
const createdAt = new Date('2026-08-28T00:00:00.000Z');

const draft = (overrides: Partial<ConstructorParameters<typeof FuelIssuance>[0]> = {}) =>
  new FuelIssuance({
    publicId: publicId('000000000301'),
    purchaseRequestNumber: PurchaseRequestNumber.from('PR-2026-001'),
    entryDate: EntryDate.from('2026-08-28'),
    driverPublicId: publicId('000000000302'),
    destination: undefined,
    purpose: 'Official provincial travel',
    vehiclePublicId: publicId('000000000303'),
    requestedLiters: FuelQuantity.from('30'),
    isFullTank: false,
    issuedLiters: null,
    unitPrice: UnitPrice.from('61.25'),
    budgetAllocationPublicId: publicId('000000000304'),
    fuelType: FuelType.diesel(),
    createdByActorPublicId: publicId('000000000305'),
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });

describe('FuelIssuance', () => {
  it('creates a draft with AOR destination and nullable actual quantity', () => {
    const issuance = draft();

    expect(issuance.status.toString()).toBe('DRAFT');
    expect(issuance.destination).toBe('AOR');
    expect(issuance.issuedLiters).toBeNull();
    expect(issuance.risNumber).toBeNull();
    expect(issuance.totalAmount).toBeNull();
  });

  it('requires null requested liters for full tank and positive requested liters otherwise', () => {
    expect(() =>
      draft({
        isFullTank: true,
        requestedLiters: FuelQuantity.from('10'),
      }),
    ).toThrow(DomainError);
    expect(() => draft({ isFullTank: false, requestedLiters: null })).toThrow(DomainError);

    const fullTank = draft({ isFullTank: true, requestedLiters: null });
    expect(fullTank.requestedLiters).toBeNull();
  });

  it('normalizes editable text and updates only draft business facts', () => {
    const issuance = draft();
    const updatedAt = new Date('2026-08-28T01:00:00.000Z');

    issuance.updateDraft(
      {
        purchaseRequestNumber: PurchaseRequestNumber.from('PR-2026-002'),
        entryDate: EntryDate.from('2026-09-01'),
        driverPublicId: publicId('000000000306'),
        destination: '  Provincial   Capitol  ',
        purpose: '  Emergency   response  ',
        vehiclePublicId: publicId('000000000307'),
        requestedLiters: null,
        isFullTank: true,
        issuedLiters: FuelQuantity.from('42.125'),
        unitPrice: UnitPrice.from('62.10'),
        budgetAllocationPublicId: publicId('000000000308'),
        fuelType: FuelType.gasoline(),
      },
      updatedAt,
    );

    expect(issuance.purchaseRequestNumber.toString()).toBe('PR-2026-002');
    expect(issuance.destination).toBe('Provincial Capitol');
    expect(issuance.purpose).toBe('Emergency response');
    expect(issuance.isFullTank).toBe(true);
    expect(issuance.issuedLiters?.toString()).toBe('42.125');
    expect(issuance.updatedAt).toEqual(updatedAt);
  });

  it('posts once with immutable RIS, actual quantity, total, and timestamp', () => {
    const issuance = draft();
    const postedAt = new Date('2026-08-28T02:00:00.000Z');
    const quantity = FuelQuantity.from('30.125');
    const total = FuelTotal.calculate(quantity, issuance.unitPrice);

    issuance.post({
      risNumber: RisNumber.issue(issuance.entryDate, 1),
      issuedLiters: quantity,
      totalAmount: total,
      at: postedAt,
    });

    expect(issuance.status.toString()).toBe('POSTED');
    expect(issuance.risNumber?.toString()).toBe('2026-08-001');
    expect(issuance.issuedLiters?.toString()).toBe('30.125');
    expect(issuance.totalAmount?.toString()).toBe('1845.16');
    expect(issuance.postedAt).toEqual(postedAt);
    expect(() =>
      issuance.post({
        risNumber: RisNumber.issue(issuance.entryDate, 2),
        issuedLiters: quantity,
        totalAmount: total,
        at: postedAt,
      }),
    ).toThrow('Only draft fuel issuances can be posted.');
    expect(() =>
      issuance.updateDraft(
        {
          purchaseRequestNumber: issuance.purchaseRequestNumber,
          entryDate: issuance.entryDate,
          driverPublicId: issuance.driverPublicId,
          destination: issuance.destination,
          purpose: issuance.purpose,
          vehiclePublicId: issuance.vehiclePublicId,
          requestedLiters: issuance.requestedLiters,
          isFullTank: issuance.isFullTank,
          issuedLiters: issuance.issuedLiters,
          unitPrice: issuance.unitPrice,
          budgetAllocationPublicId: issuance.budgetAllocationPublicId,
          fuelType: issuance.fuelType,
        },
        postedAt,
      ),
    ).toThrow('Only draft fuel issuances can be edited.');
  });

  it('voids a posted issuance once while preserving every posting fact', () => {
    const issuance = draft();
    const quantity = FuelQuantity.from('30');
    issuance.post({
      risNumber: RisNumber.issue(issuance.entryDate, 7),
      issuedLiters: quantity,
      totalAmount: FuelTotal.calculate(quantity, issuance.unitPrice),
      at: new Date('2026-08-28T02:00:00.000Z'),
    });
    const originalRis = issuance.risNumber;
    const originalTotal = issuance.totalAmount;
    const voidedAt = new Date('2026-08-28T03:00:00.000Z');

    issuance.void({
      at: voidedAt,
      actorPublicId: publicId('000000000309'),
      reason: '  Incorrect   vehicle assignment.  ',
    });

    expect(issuance.status.toString()).toBe('VOIDED');
    expect(issuance.risNumber).toBe(originalRis);
    expect(issuance.totalAmount).toBe(originalTotal);
    expect(issuance.voidReason).toBe('Incorrect vehicle assignment.');
    expect(issuance.voidedAt).toEqual(voidedAt);
    expect(() =>
      issuance.void({
        at: voidedAt,
        actorPublicId: publicId('000000000309'),
        reason: 'Another valid reason.',
      }),
    ).toThrow('Only posted fuel issuances can be voided.');
  });

  it.each(['short', 'x'.repeat(501)])('rejects invalid void reason %j', (reason) => {
    const issuance = draft();
    const quantity = FuelQuantity.from('30');
    issuance.post({
      risNumber: RisNumber.issue(issuance.entryDate, 7),
      issuedLiters: quantity,
      totalAmount: FuelTotal.calculate(quantity, issuance.unitPrice),
      at: new Date('2026-08-28T02:00:00.000Z'),
    });

    expect(() =>
      issuance.void({
        at: new Date('2026-08-28T03:00:00.000Z'),
        actorPublicId: publicId('000000000309'),
        reason,
      }),
    ).toThrow(DomainError);
  });
});
