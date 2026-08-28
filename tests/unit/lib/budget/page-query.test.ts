import { describe, expect, it } from 'vitest';

import {
  budgetAllocationPaginationHref,
  hasActiveBudgetAllocationFilters,
  parseBudgetAllocationPageQuery,
} from '@/lib/budget/page-query';

describe('budget allocation page query', () => {
  it('uses the UI page size and rejects repeated native values', () => {
    const parsed = parseBudgetAllocationPageQuery({ fiscalYear: '2026', quarter: '3' });
    expect(parsed.query).toMatchObject({
      mode: 'admin',
      pageSize: 25,
      fiscalYear: 2026,
      quarter: 3,
    });
    expect(() => parseBudgetAllocationPageQuery({ query: ['one', 'two'] })).toThrow();
  });

  it('preserves every active filter in cursor links', () => {
    const values = {
      query: 'budget',
      fiscalYear: '2026',
      quarter: '3',
      status: 'ACTIVE',
      lifecycle: 'deleted',
    };
    expect(hasActiveBudgetAllocationFilters(values)).toBe(true);
    expect(budgetAllocationPaginationHref(values, 'cursor-value')).toBe(
      '/budget-allocations?query=budget&fiscalYear=2026&quarter=3&status=ACTIVE&lifecycle=deleted&cursor=cursor-value',
    );
  });
});
