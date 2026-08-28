import type { BudgetAllocationListQuery } from '@/application/budget/dto/budget-allocation-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { parseBudgetAllocationListQuery } from '@/lib/budget/route-schemas';

export type BudgetAllocationPageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface BudgetAllocationFilterValues {
  readonly query: string;
  readonly fiscalYear: string;
  readonly quarter: string;
  readonly status: string;
  readonly lifecycle: string;
}

export function parseBudgetAllocationPageQuery(params: BudgetAllocationPageSearchParams): {
  readonly query: BudgetAllocationListQuery;
  readonly values: BudgetAllocationFilterValues;
} {
  const normalized: Record<string, string> = { mode: 'admin', pageSize: '25' };
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new ValidationError();
    normalized[name] = value;
  }
  const query = parseBudgetAllocationListQuery(normalized);
  if (query.mode !== 'admin') throw new ValidationError();
  return {
    query,
    values: {
      query: typeof params.query === 'string' ? params.query : '',
      fiscalYear: typeof params.fiscalYear === 'string' ? params.fiscalYear : '',
      quarter: typeof params.quarter === 'string' ? params.quarter : '',
      status: typeof params.status === 'string' ? params.status : '',
      lifecycle: typeof params.lifecycle === 'string' ? params.lifecycle : 'current',
    },
  };
}

export function hasActiveBudgetAllocationFilters(values: BudgetAllocationFilterValues): boolean {
  return (
    values.query.length > 0 ||
    values.fiscalYear.length > 0 ||
    values.quarter.length > 0 ||
    values.status.length > 0 ||
    values.lifecycle !== 'current'
  );
}

export function budgetAllocationPaginationHref(
  values: BudgetAllocationFilterValues,
  cursor: string,
): string {
  const params = new URLSearchParams();
  if (values.query.length > 0) params.set('query', values.query);
  if (values.fiscalYear.length > 0) params.set('fiscalYear', values.fiscalYear);
  if (values.quarter.length > 0) params.set('quarter', values.quarter);
  if (values.status.length > 0) params.set('status', values.status);
  if (values.lifecycle !== 'current') params.set('lifecycle', values.lifecycle);
  params.set('cursor', cursor);
  return `/budget-allocations?${params.toString()}`;
}
