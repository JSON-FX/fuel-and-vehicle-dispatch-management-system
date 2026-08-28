import type { AuditSearchQuery } from '@/application/audit/dto/audit-event-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import type { AuditFilterValues } from '@/components/audit/audit-filter-form';
import { auditSearchQuerySchema } from '@/lib/audit/route-schemas';

export type AuditPageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface ParsedAuditPageQuery {
  readonly query: AuditSearchQuery;
  readonly values: AuditFilterValues;
}

const filterNames = [
  'from',
  'to',
  'action',
  'entityType',
  'entityPublicId',
  'actorPublicId',
  'requestId',
] as const;

export function parseAuditPageQuery(params: AuditPageSearchParams): ParsedAuditPageQuery {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value !== 'string') throw new ValidationError();
    normalized[name] = value;
  }

  const parsed = auditSearchQuerySchema.safeParse(normalized);
  if (!parsed.success) throw new ValidationError();
  const values = auditFilterValues(params);
  return {
    values,
    query: {
      from: parsed.data.from ?? null,
      to: parsed.data.to ?? null,
      action: parsed.data.action ?? null,
      entityType: parsed.data.entityType ?? null,
      entityPublicId: parsed.data.entityPublicId ?? null,
      actorPublicId: parsed.data.actorPublicId ?? null,
      requestId: parsed.data.requestId ?? null,
      cursor: parsed.data.cursor ?? null,
      pageSize: parsed.data.pageSize,
    },
  };
}

export function auditFilterValues(params: AuditPageSearchParams): AuditFilterValues {
  return Object.fromEntries(
    filterNames.map((name) => [name, typeof params[name] === 'string' ? params[name] : '']),
  ) as unknown as AuditFilterValues;
}

export function hasActiveAuditFilters(values: AuditFilterValues): boolean {
  return filterNames.some((name) => values[name].length > 0);
}

export function auditPaginationHref(values: AuditFilterValues, cursor: string): string {
  const query = new URLSearchParams();
  for (const name of filterNames) {
    if (values[name].length > 0) query.set(name, values[name]);
  }
  query.set('cursor', cursor);
  return `/audit?${query.toString()}`;
}
