import type {
  ReportPeriodType,
  ResolvedReportPeriod,
} from '@/application/reporting/dto/report-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';

interface ResolveReportPeriodInput {
  readonly periodType: ReportPeriodType;
  readonly referenceDate?: string;
  readonly startDate?: string;
  readonly endDate?: string;
}

export class ReportPeriodPolicy {
  resolve(input: ResolveReportPeriodInput): ResolvedReportPeriod {
    if (input.periodType === 'CUSTOM') return this.resolveCustom(input.startDate, input.endDate);

    const referenceDate = requireCivilDate(input.referenceDate, 'referenceDate');
    const reference = parseCivilDate(referenceDate);
    const year = reference.getUTCFullYear();
    const month = reference.getUTCMonth();
    let start: Date;
    let end: Date;

    switch (input.periodType) {
      case 'WEEKLY': {
        const mondayOffset = (reference.getUTCDay() + 6) % 7;
        start = addDays(reference, -mondayOffset);
        end = addDays(start, 6);
        break;
      }
      case 'MONTHLY':
        start = new Date(Date.UTC(year, month, 1));
        end = new Date(Date.UTC(year, month + 1, 0));
        break;
      case 'QUARTERLY': {
        const quarterStartMonth = Math.floor(month / 3) * 3;
        start = new Date(Date.UTC(year, quarterStartMonth, 1));
        end = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
        break;
      }
      case 'ANNUAL':
        start = new Date(Date.UTC(year, 0, 1));
        end = new Date(Date.UTC(year, 11, 31));
        break;
    }

    return Object.freeze({
      periodType: input.periodType,
      startDate: formatCivilDate(start),
      endDate: formatCivilDate(end),
      referenceDate,
      timeZone: 'Asia/Manila',
    });
  }

  private resolveCustom(startValue?: string, endValue?: string): ResolvedReportPeriod {
    const startDate = requireCivilDate(startValue, 'startDate');
    const endDate = requireCivilDate(endValue, 'endDate');
    if (startDate > endDate) invalid('endDate', 'End date must be on or after start date.');

    return Object.freeze({
      periodType: 'CUSTOM',
      startDate,
      endDate,
      referenceDate: null,
      timeZone: 'Asia/Manila',
    });
  }
}

export function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && formatCivilDate(parsed) === value;
}

function requireCivilDate(value: string | undefined, field: string): string {
  if (value === undefined || !isCivilDate(value)) invalid(field, 'Provide a valid civil date.');
  return value;
}

function parseCivilDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.valueOf() + days * 86_400_000);
}

function formatCivilDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function invalid(field: string, reason: string): never {
  throw new ValidationError([{ field, reason }]);
}
