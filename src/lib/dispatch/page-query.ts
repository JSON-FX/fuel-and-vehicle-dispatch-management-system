import type { DispatchListQuery } from '@/application/dispatch/dto/dispatch-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { parseDispatchListQuery } from '@/lib/dispatch/route-schemas';

export type DispatchPageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface DispatchFilterValues {
  readonly query: string;
  readonly status: string;
  readonly requestingOfficePublicId: string;
  readonly travelDateFrom: string;
  readonly travelDateTo: string;
}

export function parseDispatchPageQuery(params: DispatchPageSearchParams): {
  readonly query: DispatchListQuery;
  readonly values: DispatchFilterValues;
} {
  const normalized: Record<string, string> = { pageSize: '25' };
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new ValidationError();
    normalized[name] = value;
  }
  const query = parseDispatchListQuery(normalized);
  return {
    query,
    values: {
      query: typeof params.query === 'string' ? params.query : '',
      status: typeof params.status === 'string' ? params.status : '',
      requestingOfficePublicId:
        typeof params.requestingOfficePublicId === 'string' ? params.requestingOfficePublicId : '',
      travelDateFrom: typeof params.travelDateFrom === 'string' ? params.travelDateFrom : '',
      travelDateTo: typeof params.travelDateTo === 'string' ? params.travelDateTo : '',
    },
  };
}

export function dispatchPaginationHref(values: DispatchFilterValues, cursor: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value.length > 0) params.set(key, value);
  }
  params.set('cursor', cursor);
  return `/dispatches?${params.toString()}`;
}
