import { describe, expect, it } from 'vitest';

import { ManilaFiscalPeriodPolicy } from '@/domain/budget/policies/manila-fiscal-period-policy';

describe('Manila fiscal period policy', () => {
  const policy = new ManilaFiscalPeriodPolicy();

  it.each([
    ['2026-01-31T16:00:00.000Z', 2026, 1],
    ['2026-03-31T15:59:59.999Z', 2026, 1],
    ['2026-03-31T16:00:00.000Z', 2026, 2],
    ['2026-06-30T16:00:00.000Z', 2026, 3],
    ['2026-09-30T16:00:00.000Z', 2026, 4],
    ['2026-12-31T15:59:59.999Z', 2026, 4],
    ['2026-12-31T16:00:00.000Z', 2027, 1],
  ])('resolves %s using Asia/Manila civil time', (instant, fiscalYear, quarter) => {
    expect(policy.resolve(new Date(instant))).toEqual({ fiscalYear, quarter });
  });

  it.each([
    ['2026-01-01', 2026, 1],
    ['2026-04-01', 2026, 2],
    ['2026-07-01', 2026, 3],
    ['2026-10-01', 2026, 4],
    ['2028-02-29', 2028, 1],
  ])('resolves civil date %s without a browser timezone shift', (date, fiscalYear, quarter) => {
    expect(policy.resolveCivilDate(date)).toEqual({ fiscalYear, quarter });
  });

  it('rejects invalid fiscal periods and civil dates', () => {
    expect(() => policy.validate({ fiscalYear: 1999, quarter: 1 })).toThrow();
    expect(() => policy.validate({ fiscalYear: 2026, quarter: 5 })).toThrow();
    expect(() => policy.resolveCivilDate('2026-02-29')).toThrow(
      'Effective date must be a valid calendar date in YYYY-MM-DD format.',
    );
    expect(() => policy.resolveCivilDate('2026-01-01T00:00:00Z')).toThrow(
      'Effective date must be a valid calendar date in YYYY-MM-DD format.',
    );
  });

  it('requires an exact fiscal-period match for eligibility', () => {
    const effectiveDate = new Date('2026-06-30T16:00:00.000Z');

    expect(policy.isEligible({ fiscalYear: 2026, quarter: 3 }, effectiveDate)).toBe(true);
    expect(policy.isEligible({ fiscalYear: 2026, quarter: 2 }, effectiveDate)).toBe(false);
    expect(policy.isEligible({ fiscalYear: 2027, quarter: 3 }, effectiveDate)).toBe(false);
  });
});
