import type { ReportPeriodType } from '@/application/reporting/dto/report-dtos';

export function formatReportCivilDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function formatReportDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

export function formatReportNumber(value: string, fractionDigits = 3): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value));
}

export function formatReportCurrency(value: string): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function reportPeriodLabel(periodType: ReportPeriodType): string {
  return periodType.charAt(0) + periodType.slice(1).toLowerCase();
}

export function reportStatusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ');
}
