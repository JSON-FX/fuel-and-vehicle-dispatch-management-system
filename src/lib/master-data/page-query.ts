import type {
  MasterDataListQuery,
  MasterDataResource,
} from '@/application/master-data/dto/master-data-list-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { parseMasterDataListQuery } from '@/lib/master-data/route-schemas';

export type MasterDataPageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface MasterDataFilterValues {
  readonly query: string;
  readonly lifecycle: string;
  readonly status: string;
}

export function parseMasterDataPageQuery(
  resource: MasterDataResource,
  params: MasterDataPageSearchParams,
): { readonly query: MasterDataListQuery; readonly values: MasterDataFilterValues } {
  const normalized: Record<string, string> = { mode: 'admin', pageSize: '25' };
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new ValidationError();
    normalized[name] = value;
  }
  const query = parseMasterDataListQuery(resource, normalized);
  return {
    query,
    values: {
      query: typeof params.query === 'string' ? params.query : '',
      lifecycle: typeof params.lifecycle === 'string' ? params.lifecycle : 'current',
      status: typeof params.status === 'string' ? params.status : '',
    },
  };
}

export function hasActiveMasterDataFilters(values: MasterDataFilterValues): boolean {
  return values.query.length > 0 || values.lifecycle !== 'current' || values.status.length > 0;
}

export function masterDataPaginationHref(
  resource: MasterDataResource,
  values: MasterDataFilterValues,
  cursor: string,
): string {
  const params = new URLSearchParams();
  if (values.query.length > 0) params.set('query', values.query);
  if (values.lifecycle !== 'current') params.set('lifecycle', values.lifecycle);
  if (values.status.length > 0) params.set('status', values.status);
  params.set('cursor', cursor);
  return `/admin/${resource === 'office' ? 'offices' : `${resource}s`}?${params.toString()}`;
}
