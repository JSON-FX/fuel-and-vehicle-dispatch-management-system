import { DomainError } from '@/domain/shared/errors/domain-error';

const ENTRY_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export class EntryDate {
  private constructor(private readonly value: string) {}

  static from(value: unknown): EntryDate {
    if (typeof value !== 'string') {
      throw new DomainError(
        'INVALID_FUEL_ENTRY_DATE',
        'Entry date must be a valid calendar date in YYYY-MM-DD format.',
      );
    }

    const match = ENTRY_DATE_PATTERN.exec(value);
    if (match === null) {
      throw new DomainError(
        'INVALID_FUEL_ENTRY_DATE',
        'Entry date must be a valid calendar date in YYYY-MM-DD format.',
      );
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
      throw new DomainError(
        'INVALID_FUEL_ENTRY_DATE',
        'Entry date must be a valid calendar date in YYYY-MM-DD format.',
      );
    }

    return new EntryDate(value);
  }

  get year(): number {
    return Number(this.value.slice(0, 4));
  }

  get month(): number {
    return Number(this.value.slice(5, 7));
  }

  toEffectiveInstant(): Date {
    return new Date(`${this.value}T00:00:00+08:00`);
  }

  toString(): string {
    return this.value;
  }
}
