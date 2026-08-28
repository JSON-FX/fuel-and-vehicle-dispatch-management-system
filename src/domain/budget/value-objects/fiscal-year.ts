import { DomainError } from '@/domain/shared/errors/domain-error';

export class FiscalYear {
  private constructor(private readonly value: number) {}

  static from(value: number): FiscalYear {
    if (!Number.isInteger(value) || value < 2000 || value > 9999) {
      throw new DomainError(
        'INVALID_FISCAL_YEAR',
        'Fiscal year must be an integer from 2000 through 9999.',
      );
    }

    return new FiscalYear(value);
  }

  toNumber(): number {
    return this.value;
  }
}
