import { DomainError } from '@/domain/shared/errors/domain-error';

const MAX_UNSIGNED_INTEGER = 4_294_967_295;

export class PassengerCount {
  private constructor(private readonly value: number) {}

  static from(value: unknown): PassengerCount {
    if (
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_UNSIGNED_INTEGER
    ) {
      throw new DomainError(
        'INVALID_PASSENGER_COUNT',
        'Passenger count must be a nonnegative integer.',
      );
    }

    return new PassengerCount(value);
  }

  toNumber(): number {
    return this.value;
  }
}
