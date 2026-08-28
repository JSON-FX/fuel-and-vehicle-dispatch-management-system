import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { DomainError } from '@/domain/shared/errors/domain-error';

const RIS_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(\d{3,})$/;

export class RisNumber {
  private constructor(
    private readonly value: string,
    readonly sequence: number,
  ) {}

  static issue(entryDate: EntryDate, sequence: number): RisNumber {
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      throw new DomainError('INVALID_RIS_SEQUENCE', 'RIS sequence must be a positive integer.');
    }
    const paddedSequence = String(sequence).padStart(3, '0');
    const month = String(entryDate.month).padStart(2, '0');
    return new RisNumber(`${entryDate.year}-${month}-${paddedSequence}`, sequence);
  }

  static from(value: unknown): RisNumber {
    if (typeof value !== 'string') {
      throw new DomainError('INVALID_RIS_NUMBER', 'RIS number is invalid.');
    }
    const match = RIS_PATTERN.exec(value);
    const sequence = match === null ? Number.NaN : Number(match[3]);
    if (match === null || !Number.isSafeInteger(sequence) || sequence < 1) {
      throw new DomainError('INVALID_RIS_NUMBER', 'RIS number is invalid.');
    }
    return new RisNumber(value, sequence);
  }

  toString(): string {
    return this.value;
  }
}
