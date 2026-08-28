import { DomainError } from '@/domain/shared/errors/domain-error';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { Quarter, type QuarterNumber } from '@/domain/budget/value-objects/quarter';
import type { FiscalPeriod, FiscalPeriodPolicy } from './fiscal-period-policy';

const MANILA_TIME_ZONE = 'Asia/Manila';
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function quarterForMonth(month: number): QuarterNumber {
  return Math.ceil(month / 3) as QuarterNumber;
}

export class ManilaFiscalPeriodPolicy implements FiscalPeriodPolicy {
  validate(period: { readonly fiscalYear: number; readonly quarter: number }): void {
    FiscalYear.from(period.fiscalYear);
    Quarter.from(period.quarter);
  }

  resolve(date: Date): FiscalPeriod {
    if (Number.isNaN(date.getTime())) {
      throw new DomainError('INVALID_EFFECTIVE_DATE', 'Effective date is invalid.');
    }

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: MANILA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(date);
    const fiscalYear = Number(parts.find((part) => part.type === 'year')?.value);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const period = { fiscalYear, quarter: quarterForMonth(month) };
    this.validate(period);
    return period;
  }

  resolveCivilDate(value: string): FiscalPeriod {
    const match = CIVIL_DATE_PATTERN.exec(value);
    if (match === null) this.throwInvalidCivilDate();

    const fiscalYear = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(fiscalYear, month - 1, day));

    if (
      parsed.getUTCFullYear() !== fiscalYear ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      this.throwInvalidCivilDate();
    }

    const period = { fiscalYear, quarter: quarterForMonth(month) };
    try {
      this.validate(period);
    } catch {
      throw new DomainError(
        'INVALID_EFFECTIVE_DATE',
        'Effective date must be a valid calendar date in YYYY-MM-DD format.',
      );
    }
    return period;
  }

  isEligible(
    allocation: { readonly fiscalYear: number; readonly quarter: number },
    effectiveDate: Date,
  ): boolean {
    this.validate(allocation);
    const period = this.resolve(effectiveDate);
    return allocation.fiscalYear === period.fiscalYear && allocation.quarter === period.quarter;
  }

  private throwInvalidCivilDate(): never {
    throw new DomainError(
      'INVALID_EFFECTIVE_DATE',
      'Effective date must be a valid calendar date in YYYY-MM-DD format.',
    );
  }
}
