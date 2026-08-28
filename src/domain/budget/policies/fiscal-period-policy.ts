import type { QuarterNumber } from '@/domain/budget/value-objects/quarter';

export interface FiscalPeriod {
  readonly fiscalYear: number;
  readonly quarter: QuarterNumber;
}

export interface FiscalPeriodPolicy {
  validate(period: { readonly fiscalYear: number; readonly quarter: number }): void;
  resolve(date: Date): FiscalPeriod;
  resolveCivilDate(value: string): FiscalPeriod;
  isEligible(
    allocation: { readonly fiscalYear: number; readonly quarter: number },
    effectiveDate: Date,
  ): boolean;
}
