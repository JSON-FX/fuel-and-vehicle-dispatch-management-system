import { DomainError } from '@/domain/shared/errors/domain-error';

export type VehicleStatusValue = 'SERVICEABLE' | 'UNSERVICEABLE';

export class VehicleStatus {
  private constructor(private readonly value: VehicleStatusValue) {}

  static from(value: string): VehicleStatus {
    if (value !== 'SERVICEABLE' && value !== 'UNSERVICEABLE') {
      throw new DomainError('INVALID_VEHICLE_STATUS', 'Vehicle status is invalid.');
    }
    return new VehicleStatus(value);
  }

  static serviceable(): VehicleStatus {
    return new VehicleStatus('SERVICEABLE');
  }

  static unserviceable(): VehicleStatus {
    return new VehicleStatus('UNSERVICEABLE');
  }

  isServiceable(): boolean {
    return this.value === 'SERVICEABLE';
  }

  toString(): VehicleStatusValue {
    return this.value;
  }
}
