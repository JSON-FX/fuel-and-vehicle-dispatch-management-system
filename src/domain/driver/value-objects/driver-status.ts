import { DomainError } from '@/domain/shared/errors/domain-error';

export type DriverStatusValue = 'ACTIVE' | 'INACTIVE';

export class DriverStatus {
  private constructor(private readonly value: DriverStatusValue) {}

  static from(value: string): DriverStatus {
    if (value !== 'ACTIVE' && value !== 'INACTIVE') {
      throw new DomainError('INVALID_DRIVER_STATUS', 'Driver status is invalid.');
    }
    return new DriverStatus(value);
  }

  static active(): DriverStatus {
    return new DriverStatus('ACTIVE');
  }

  static inactive(): DriverStatus {
    return new DriverStatus('INACTIVE');
  }

  isActive(): boolean {
    return this.value === 'ACTIVE';
  }

  toString(): DriverStatusValue {
    return this.value;
  }
}
