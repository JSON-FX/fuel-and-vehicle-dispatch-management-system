import { z } from 'zod';

import {
  REPORT_TYPES,
  type NormalizedReportFilters,
} from '@/application/reporting/dto/report-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { parseReportPageQuery } from '@/lib/reporting/page-query';

export const reportTypeSchema = z.enum(REPORT_TYPES);
export const reportExportJobPublicIdSchema = z.string().uuid();

const reportFilterKeys = new Set([
  'requestingOfficePublicId',
  'periodType',
  'referenceDate',
  'startDate',
  'endDate',
  'status',
  'cursor',
  'pageSize',
]);

const reportExportBodySchema = z
  .object({
    reportType: reportTypeSchema,
    requestingOfficePublicId: z.string().trim().optional(),
    periodType: z.string().trim().optional(),
    referenceDate: z.string().trim().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    status: z.string().trim().optional(),
  })
  .strict();

const emptyBodySchema = z.object({}).strict();

export function parseReportRouteQuery(
  reportType: unknown,
  searchParams: URLSearchParams,
  today: string,
): NormalizedReportFilters {
  const parsedType = reportTypeSchema.parse(reportType);
  const input = strictSearchParams(searchParams, reportFilterKeys);
  const parsed = parseReportPageQuery({ ...input, report: parsedType }, today);
  if (parsed.filters === null) throw new ValidationError();
  return parsed.filters;
}

export function parseReportExportBody(body: unknown, today: string): NormalizedReportFilters {
  const parsed = reportExportBodySchema.parse(body);
  const pageQuery = parseReportPageQuery(
    {
      report: parsed.reportType,
      ...(parsed.requestingOfficePublicId === undefined
        ? {}
        : { requestingOfficePublicId: parsed.requestingOfficePublicId }),
      ...(parsed.periodType === undefined ? {} : { periodType: parsed.periodType }),
      ...(parsed.referenceDate === undefined ? {} : { referenceDate: parsed.referenceDate }),
      ...(parsed.startDate === undefined ? {} : { startDate: parsed.startDate }),
      ...(parsed.endDate === undefined ? {} : { endDate: parsed.endDate }),
      ...(parsed.status === undefined ? {} : { status: parsed.status }),
      pageSize: '200',
    },
    today,
  );
  if (pageQuery.filters === null) throw new ValidationError();
  return pageQuery.filters;
}

export function parseExportJobListQuery(searchParams: URLSearchParams): { readonly limit: number } {
  const input = strictSearchParams(searchParams, new Set(['limit']));
  const rawLimit = singleValue(input.limit, 'limit') || '20';
  if (!/^\d{1,2}$/.test(rawLimit)) invalid('limit', 'Limit must be an integer.');
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 50) invalid('limit', 'Limit must be between 1 and 50.');
  return { limit };
}

export function parseDownloadQuery(searchParams: URLSearchParams): { readonly token: string } {
  const input = strictSearchParams(searchParams, new Set(['token']));
  const token = singleValue(input.token, 'token');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) invalid('token', 'Provide a valid download token.');
  return { token };
}

export function parseEmptyJsonBody(body: unknown): Record<string, never> {
  return emptyBodySchema.parse(body);
}

function strictSearchParams(
  searchParams: URLSearchParams,
  allowedKeys: ReadonlySet<string>,
): Readonly<Record<string, string | readonly string[]>> {
  const result: Record<string, string | readonly string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    if (!allowedKeys.has(key)) invalid(key, 'Unknown query parameter.');
    const values = searchParams.getAll(key);
    result[key] = values.length === 1 ? (values[0] ?? '') : values;
  }
  return result;
}

function singleValue(value: string | readonly string[] | undefined, field: string): string {
  if (typeof value !== 'string') {
    if (value !== undefined) invalid(field, 'Provide this query parameter once.');
    return '';
  }
  return value.trim();
}

function invalid(field: string, reason: string): never {
  throw new ValidationError([{ field, reason }]);
}
