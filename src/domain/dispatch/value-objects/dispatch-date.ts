import { DomainError } from '@/domain/shared/errors/domain-error';

const DISPATCH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DispatchDate {
  private constructor(private readonly value: string) {}

  static from(value: unknown): DispatchDate {
    if (typeof value !== 'string') {
      throw DispatchDate.invalid();
    }

    const match = DISPATCH_DATE_PATTERN.exec(value);
    if (match === null) {
      throw DispatchDate.invalid();
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));

    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() + 1 !== month ||
      candidate.getUTCDate() !== day
    ) {
      throw DispatchDate.invalid();
    }

    return new DispatchDate(value);
  }

  toString(): string {
    return this.value;
  }

  private static invalid(): DomainError {
    return new DomainError(
      'INVALID_DISPATCH_DATE',
      'Dispatch date must be a valid calendar date in YYYY-MM-DD format.',
    );
  }
}
