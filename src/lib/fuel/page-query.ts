import type { FuelIssuanceListQuery } from '@/application/fuel/dto/fuel-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { parseFuelIssuanceListQuery } from '@/lib/fuel/route-schemas';

export type FuelPageSearchParams = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface FuelFilterValues {
  readonly query: string;
  readonly status: string;
  readonly fuelType: string;
  readonly startDate: string;
  readonly endDate: string;
}

export function parseFuelPageQuery(params: FuelPageSearchParams): {
  readonly query: FuelIssuanceListQuery;
  readonly values: FuelFilterValues;
} {
  const normalized: Record<string, string> = { pageSize: '25' };
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new ValidationError();
    normalized[name] = value;
  }
  const query = parseFuelIssuanceListQuery(normalized);
  return {
    query,
    values: {
      query: typeof params.query === 'string' ? params.query : '',
      status: typeof params.status === 'string' ? params.status : '',
      fuelType: typeof params.fuelType === 'string' ? params.fuelType : '',
      startDate: typeof params.startDate === 'string' ? params.startDate : '',
      endDate: typeof params.endDate === 'string' ? params.endDate : '',
    },
  };
}

export function fuelPaginationHref(values: FuelFilterValues, cursor: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value.length > 0) params.set(key, value);
  params.set('cursor', cursor);
  return `/fuel-issuances?${params.toString()}`;
}
