import type {
  DispatchDetailsCommand,
  DispatchDriverDto,
  DispatchOfficeDto,
  DispatchVehicleDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import { BusinessRuleError, ValidationError } from '@/application/shared/errors/application-error';
import type { DraftDispatchDetails } from '@/domain/dispatch/entities/vehicle-dispatch';
import { DispatchDate } from '@/domain/dispatch/value-objects/dispatch-date';
import { OdometerReading } from '@/domain/dispatch/value-objects/odometer-reading';
import { PassengerCount } from '@/domain/dispatch/value-objects/passenger-count';
import type { Driver } from '@/domain/driver/entities/driver';
import type { Office } from '@/domain/office/entities/office';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Vehicle } from '@/domain/vehicle/entities/vehicle';

function fieldValue<T>(field: string, create: () => T): T {
  try {
    return create();
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ValidationError([{ field, reason: error.message }]);
    }
    throw error;
  }
}

function normalizedText(field: 'destination' | 'purpose', value: string): string {
  const normalized = value.trim().replaceAll(/\s+/g, ' ');
  const maximum = field === 'destination' ? 255 : 500;
  if (normalized.length < 1 || normalized.length > maximum) {
    throw new ValidationError([
      {
        field,
        reason: `${field === 'destination' ? 'Destination' : 'Purpose'} must contain 1 to ${maximum} characters.`,
      },
    ]);
  }
  return normalized;
}

export function dispatchDetails(command: DispatchDetailsCommand): DraftDispatchDetails {
  return {
    entryDate: fieldValue('entryDate', () => DispatchDate.from(command.entryDate)),
    travelDate: fieldValue('travelDate', () => DispatchDate.from(command.travelDate)),
    driverPublicId: fieldValue('driverPublicId', () => PublicId.from(command.driverPublicId)),
    vehiclePublicId: fieldValue('vehiclePublicId', () => PublicId.from(command.vehiclePublicId)),
    requestingOfficePublicId: fieldValue('requestingOfficePublicId', () =>
      PublicId.from(command.requestingOfficePublicId),
    ),
    destination: normalizedText('destination', command.destination),
    purpose: normalizedText('purpose', command.purpose),
    odoBefore: fieldValue('odoBefore', () => OdometerReading.from(command.odoBefore)),
    passengerCount: fieldValue('passengerCount', () => PassengerCount.from(command.passengerCount)),
  };
}

export function completionOdometer(value: string): OdometerReading {
  return fieldValue('odoAfter', () => OdometerReading.from(value));
}

export function normalizeCancellationReason(reason: string): string {
  const normalized = reason.trim().replaceAll(/\s+/g, ' ');
  if (normalized.length < 10 || normalized.length > 500) {
    throw new ValidationError([
      { field: 'reason', reason: 'Provide a reason containing 10 to 500 characters.' },
    ]);
  }
  return normalized;
}

export function assertOperationalOffice(office: Office): void {
  if (!office.isOperational()) {
    throw new BusinessRuleError('The selected requesting office is not operational.');
  }
}

export function assertOperationalDriver(driver: Driver): void {
  if (!driver.isOperational()) {
    throw new BusinessRuleError('The selected driver is not operational.');
  }
}

export function assertOperationalVehicle(vehicle: Vehicle): void {
  if (!vehicle.isOperational()) {
    throw new BusinessRuleError('The selected vehicle is not serviceable.');
  }
}

export function dispatchOfficeDto(office: Office): DispatchOfficeDto {
  return {
    publicId: office.publicId.toString(),
    name: office.name.toString(),
    abbreviation: office.abbreviation.toString(),
  };
}

export function dispatchDriverDto(driver: Driver): DispatchDriverDto {
  return { publicId: driver.publicId.toString(), name: driver.name.toString() };
}

export function dispatchVehicleDto(vehicle: Vehicle): DispatchVehicleDto {
  return {
    publicId: vehicle.publicId.toString(),
    plateNumber: vehicle.plateNumber.toString(),
    modelBrand: vehicle.modelBrand.toString(),
    vehicleType: vehicle.vehicleType.toString(),
  };
}

export function asDispatchBusinessRule<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof DomainError) throw new BusinessRuleError(error.message);
    throw error;
  }
}
