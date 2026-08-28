import { describe, expect, it } from 'vitest';

import {
  budgetAllocationPublicIdSchema,
  budgetAllocationReasonSchema,
  createBudgetAllocationSchema,
  emptyBudgetAllocationBodySchema,
  parseBudgetAllocationListQuery,
  patchBudgetAllocationSchema,
} from '@/lib/budget/route-schemas';

describe('budget allocation route schemas', () => {
  it('normalizes PPMP and accepts only numeric quarter and year values', () => {
    expect(
      createBudgetAllocationSchema.parse({
        ppmpNumber: '  001-a   field ',
        officePublicId: '01900000-0000-7000-8000-000000000001',
        quarter: 3,
        fiscalYear: 2026,
      }),
    ).toMatchObject({ ppmpNumber: '001-A FIELD', quarter: 3, fiscalYear: 2026 });
    expect(
      createBudgetAllocationSchema.safeParse({
        ppmpNumber: 'PPMP',
        officePublicId: '01900000-0000-7000-8000-000000000001',
        quarter: '3',
        fiscalYear: 2026,
      }).success,
    ).toBe(false);
  });

  it('enforces strict action-specific patch bodies', () => {
    expect(patchBudgetAllocationSchema.parse({ action: 'activate' })).toEqual({
      action: 'activate',
    });
    expect(
      patchBudgetAllocationSchema.safeParse({ action: 'activate', status: 'ACTIVE' }).success,
    ).toBe(false);
    expect(patchBudgetAllocationSchema.safeParse({ action: 'update' }).success).toBe(false);
    expect(
      patchBudgetAllocationSchema.safeParse({ action: 'cancel', reason: 'short' }).success,
    ).toBe(false);
    expect(
      patchBudgetAllocationSchema.parse({
        action: 'cancel',
        reason: '  Funding   source changed. ',
      }),
    ).toEqual({ action: 'cancel', reason: 'Funding source changed.' });
  });

  it('requires UUIDv7, strict empty restore bodies, and bounded reasons', () => {
    expect(
      budgetAllocationPublicIdSchema.safeParse('01900000-0000-7000-8000-000000000001').success,
    ).toBe(true);
    expect(
      budgetAllocationPublicIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success,
    ).toBe(false);
    expect(emptyBudgetAllocationBodySchema.safeParse({ ignored: true }).success).toBe(false);
    expect(
      budgetAllocationReasonSchema.safeParse({ reason: 'A valid deletion reason.' }).success,
    ).toBe(true);
  });

  it('parses bounded administration filters and rejects repeated or excessive values', () => {
    expect(
      parseBudgetAllocationListQuery({
        mode: 'admin',
        query: '',
        fiscalYear: '2026',
        quarter: '3',
        status: 'ACTIVE',
        lifecycle: 'all',
        pageSize: '200',
      }),
    ).toEqual({
      mode: 'admin',
      query: null,
      fiscalYear: 2026,
      quarter: 3,
      status: 'ACTIVE',
      lifecycle: 'all',
      cursor: null,
      pageSize: 200,
    });
    expect(() => parseBudgetAllocationListQuery({ mode: 'admin', pageSize: '201' })).toThrow();
    expect(() => parseBudgetAllocationListQuery({ mode: 'admin', quarter: '5' })).toThrow();
  });

  it('accepts only real YYYY-MM-DD operational dates and excludes admin filters', () => {
    expect(
      parseBudgetAllocationListQuery({
        mode: 'operational',
        effectiveDate: '2028-02-29',
        pageSize: '50',
      }),
    ).toEqual({
      mode: 'operational',
      query: null,
      effectiveDate: '2028-02-29',
      cursor: null,
      pageSize: 50,
    });
    expect(() =>
      parseBudgetAllocationListQuery({ mode: 'operational', effectiveDate: '2026-02-29' }),
    ).toThrow();
    expect(() =>
      parseBudgetAllocationListQuery({ mode: 'operational', lifecycle: 'all' }),
    ).toThrow();
  });
});
