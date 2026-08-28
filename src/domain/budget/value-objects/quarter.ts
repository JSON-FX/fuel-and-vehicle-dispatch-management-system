import { DomainError } from '@/domain/shared/errors/domain-error';

export type QuarterNumber = 1 | 2 | 3 | 4;

export class Quarter {
  private constructor(private readonly value: QuarterNumber) {}

  static from(value: number): Quarter {
    if (!Number.isInteger(value) || value < 1 || value > 4) {
      throw new DomainError('INVALID_QUARTER', 'Quarter must be an integer from 1 through 4.');
    }

    return new Quarter(value as QuarterNumber);
  }

  toNumber(): QuarterNumber {
    return this.value;
  }
}
