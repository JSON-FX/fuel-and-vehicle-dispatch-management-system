import type {
  DispatchReportStatus,
  FuelReportStatus,
  NormalizedReportFilters,
  ReportPageType,
  ReportPeriodType,
  ReportType,
  ResolvedReportPeriod,
} from '@/application/reporting/dto/report-dtos';
import { REPORT_PERIOD_TYPES, REPORT_TYPES } from '@/application/reporting/dto/report-dtos';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import { ReportPeriodPolicy } from '@/application/reporting/services/report-period-policy';
import { ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export type ReportPageSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export interface ReportPageValues {
  readonly report: ReportPageType;
  readonly requestingOfficePublicId: string;
  readonly periodType: ReportPeriodType;
  readonly referenceDate: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: string;
  readonly pageSize: string;
}

export interface ParsedReportPageQuery {
  readonly values: ReportPageValues;
  readonly resolvedPeriod: ResolvedReportPeriod;
  readonly filters: NormalizedReportFilters | null;
}

const allowedKeys = new Set([
  'report',
  'requestingOfficePublicId',
  'periodType',
  'referenceDate',
  'startDate',
  'endDate',
  'status',
  'cursor',
  'pageSize',
]);

export function parseReportPageQuery(
  input: ReportPageSearchParams,
  today: string,
): ParsedReportPageQuery {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) invalid(key, 'Unknown report filter.');
  }

  const reportValue = optionalSingle(input.report, 'report') || 'OVERVIEW';
  if (reportValue !== 'OVERVIEW' && !REPORT_TYPES.includes(reportValue as ReportType)) {
    invalid('report', 'Select a supported report.');
  }
  const report = reportValue as ReportPageType;
  const periodValue = optionalSingle(input.periodType, 'periodType') || 'MONTHLY';
  if (!REPORT_PERIOD_TYPES.includes(periodValue as ReportPeriodType)) {
    invalid('periodType', 'Select a supported period.');
  }
  const periodType = periodValue as ReportPeriodType;
  const referenceDate = optionalSingle(input.referenceDate, 'referenceDate') || today;
  const startDate = optionalSingle(input.startDate, 'startDate');
  const endDate = optionalSingle(input.endDate, 'endDate');
  const resolvedPeriod = new ReportPeriodPolicy().resolve(
    periodType === 'CUSTOM' ? { periodType, startDate, endDate } : { periodType, referenceDate },
  );
  const requestingOfficePublicId = optionalPublicId(
    input.requestingOfficePublicId,
    'requestingOfficePublicId',
  );
  const status = optionalSingle(input.status, 'status');
  const cursor = optionalSingle(input.cursor, 'cursor');
  if (cursor.length > 2_048) invalid('cursor', 'Cursor is too long.');
  const pageSizeValue = optionalSingle(input.pageSize, 'pageSize') || '100';
  if (!/^\d{1,3}$/.test(pageSizeValue)) invalid('pageSize', 'Page size must be an integer.');
  const pageSize = Number(pageSizeValue);
  if (pageSize < 1 || pageSize > 200) invalid('pageSize', 'Page size must be between 1 and 200.');

  if (report === 'OVERVIEW' && status !== '') invalid('status', 'Overview has no status filter.');
  if (report !== 'OVERVIEW') validateStatus(report, status);

  const values: ReportPageValues = {
    report,
    requestingOfficePublicId,
    periodType,
    referenceDate: resolvedPeriod.referenceDate ?? '',
    startDate: periodType === 'CUSTOM' ? resolvedPeriod.startDate : '',
    endDate: periodType === 'CUSTOM' ? resolvedPeriod.endDate : '',
    status,
    pageSize: pageSizeValue,
  };

  return {
    values,
    resolvedPeriod,
    filters:
      report === 'OVERVIEW'
        ? null
        : {
            reportType: report,
            requestingOfficePublicId: requestingOfficePublicId || null,
            periodType,
            referenceDate: resolvedPeriod.referenceDate,
            startDate: resolvedPeriod.startDate,
            endDate: resolvedPeriod.endDate,
            status: status === '' ? null : (status as NormalizedReportFilters['status']),
            cursor: cursor || null,
            pageSize,
          },
  };
}

export function reportPageHref(values: ReportPageValues, cursor?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value.length > 0) params.set(key, value);
  }
  if (cursor !== undefined && cursor.length > 0) params.set('cursor', cursor);
  return `/reports?${params.toString()}`;
}

function validateStatus(reportType: ReportType, status: string): void {
  const definition = getReportDefinition(reportType);
  if (!definition.supportsStatusFilter) {
    if (status !== '') invalid('status', 'This report does not support a status filter.');
    return;
  }
  if (status === '') return;
  if (
    reportType === 'FUEL_ISSUANCE' &&
    !(['POSTED', 'VOIDED'] satisfies FuelReportStatus[]).includes(status as FuelReportStatus)
  ) {
    invalid('status', 'Select a supported fuel status.');
  }
  if (
    reportType === 'DISPATCH' &&
    !(['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'] satisfies DispatchReportStatus[]).includes(
      status as DispatchReportStatus,
    )
  ) {
    invalid('status', 'Select a supported dispatch status.');
  }
}

function optionalSingle(value: string | readonly string[] | undefined, field: string): string {
  if (typeof value !== 'string') {
    if (value !== undefined) invalid(field, 'Provide this filter once.');
    return '';
  }
  return value.trim();
}

function optionalPublicId(value: string | readonly string[] | undefined, field: string): string {
  const parsed = optionalSingle(value, field);
  if (parsed === '') return '';
  try {
    return PublicId.from(parsed).toString();
  } catch {
    invalid(field, 'Provide a valid public identifier.');
  }
}

function invalid(field: string, reason: string): never {
  throw new ValidationError([{ field, reason }]);
}
