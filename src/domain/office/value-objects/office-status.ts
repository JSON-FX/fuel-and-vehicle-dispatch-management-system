import { DomainError } from '@/domain/shared/errors/domain-error';

export type OfficeStatusValue = 'ACTIVE' | 'INACTIVE';

export class OfficeStatus {
  private constructor(private readonly value: OfficeStatusValue) {}

  static from(value: string): OfficeStatus {
    if (value !== 'ACTIVE' && value !== 'INACTIVE') {
      throw new DomainError('INVALID_OFFICE_STATUS', 'Office status is invalid.');
    }

    return new OfficeStatus(value);
  }

  static active(): OfficeStatus {
    return new OfficeStatus('ACTIVE');
  }

  static inactive(): OfficeStatus {
    return new OfficeStatus('INACTIVE');
  }

  isActive(): boolean {
    return this.value === 'ACTIVE';
  }

  toString(): OfficeStatusValue {
    return this.value;
  }
}
