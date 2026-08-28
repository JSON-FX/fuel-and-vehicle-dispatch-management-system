import { describe, expect, it } from 'vitest';

import {
  createFuelIssuanceSchema,
  parseFuelBalanceQuery,
  parseFuelIssuanceListQuery,
  postFuelIssuanceSchema,
  updateFuelIssuanceSchema,
  voidFuelIssuanceSchema,
} from '@/lib/fuel/route-schemas';

const draft = {
  purchaseRequestNumber: 'PR-2026-001',
  entryDate: '2026-08-28',
  driverPublicId: '01900000-0000-7000-8000-000000000001',
  destination: ' AOR ',
  purpose: ' Provincial operations ',
  vehiclePublicId: '01900000-0000-7000-8000-000000000002',
  requestedLiters: '30.125',
  isFullTank: false,
  issuedLiters: null,
  unitPrice: '61.25',
  budgetAllocationPublicId: '01900000-0000-7000-8000-000000000003',
  fuelType: 'DIESEL',
};

describe('fuel route schemas', () => {
  it('parses normalized draft strings and rejects server-owned fields', () => {
    expect(createFuelIssuanceSchema.parse(draft)).toMatchObject({
      destination: 'AOR',
      purpose: 'Provincial operations',
    });
    expect(() => createFuelIssuanceSchema.parse({ ...draft, risNumber: '2026-08-001' })).toThrow();
    expect(() => updateFuelIssuanceSchema.parse({ ...draft, totalAmount: '1837.50' })).toThrow();
  });

  it('enforces full-tank and decimal-string boundaries', () => {
    expect(
      createFuelIssuanceSchema.parse({ ...draft, isFullTank: true, requestedLiters: null }),
    ).toBeTruthy();
    expect(() => createFuelIssuanceSchema.parse({ ...draft, isFullTank: true })).toThrow();
    expect(() => createFuelIssuanceSchema.parse({ ...draft, requestedLiters: 30 })).toThrow();
    expect(() => createFuelIssuanceSchema.parse({ ...draft, unitPrice: '6.125' })).toThrow();
    expect(() => postFuelIssuanceSchema.parse({ issuedLiters: '1e2' })).toThrow();
  });

  it('normalizes void reasons and rejects unknown keys', () => {
    expect(voidFuelIssuanceSchema.parse({ reason: ' Duplicate   dispatch entry ' })).toEqual({
      reason: 'Duplicate dispatch entry',
    });
    expect(() => voidFuelIssuanceSchema.parse({ reason: 'too short', status: 'VOIDED' })).toThrow();
  });

  it('parses bounded list and inclusive balance filters', () => {
    expect(
      parseFuelIssuanceListQuery({ pageSize: '25', status: '', fuelType: 'GASOLINE' }),
    ).toMatchObject({
      pageSize: 25,
      status: null,
      fuelType: 'GASOLINE',
    });
    expect(parseFuelBalanceQuery({ startDate: '2026-08-01', endDate: '2026-08-31' })).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      fuelType: null,
    });
    expect(() =>
      parseFuelBalanceQuery({ startDate: '2026-08-31', endDate: '2026-08-01' }),
    ).toThrow();
  });
});
