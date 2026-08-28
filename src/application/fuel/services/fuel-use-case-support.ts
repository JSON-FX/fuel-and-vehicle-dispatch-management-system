import type { FuelIssuanceDetailsCommand } from '@/application/fuel/dto/fuel-dtos';
import type { BudgetAllocationOperationalOptionDto } from '@/application/budget/dto/budget-allocation-dtos';
import type { FuelDriverDto, FuelVehicleDto } from '@/application/fuel/dto/fuel-dtos';
import { BusinessRuleError, ValidationError } from '@/application/shared/errors/application-error';
import type { FiscalPeriodPolicy } from '@/domain/budget/policies/fiscal-period-policy';
import type { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';
import type { Driver } from '@/domain/driver/entities/driver';
import type { FuelIssuanceDetails } from '@/domain/fuel/entities/fuel-issuance';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import type { Office } from '@/domain/office/entities/office';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import type { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { DomainError } from '@/domain/shared/errors/domain-error';

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

export function fuelIssuanceDetails(command: FuelIssuanceDetailsCommand): FuelIssuanceDetails {
  return {
    purchaseRequestNumber: fieldValue('purchaseRequestNumber', () =>
      PurchaseRequestNumber.from(command.purchaseRequestNumber),
    ),
    entryDate: fieldValue('entryDate', () => EntryDate.from(command.entryDate)),
    driverPublicId: fieldValue('driverPublicId', () => PublicId.from(command.driverPublicId)),
    destination: command.destination,
    purpose: command.purpose,
    vehiclePublicId: fieldValue('vehiclePublicId', () => PublicId.from(command.vehiclePublicId)),
    requestedLiters:
      command.requestedLiters === null
        ? null
        : fieldValue('requestedLiters', () => FuelQuantity.from(command.requestedLiters)),
    isFullTank: command.isFullTank,
    issuedLiters:
      command.issuedLiters === null || command.issuedLiters === undefined
        ? null
        : fieldValue('issuedLiters', () => FuelQuantity.from(command.issuedLiters)),
    unitPrice: fieldValue('unitPrice', () => UnitPrice.from(command.unitPrice)),
    budgetAllocationPublicId: fieldValue('budgetAllocationPublicId', () =>
      PublicId.from(command.budgetAllocationPublicId),
    ),
    fuelType: fieldValue('fuelType', () => FuelType.from(command.fuelType)),
  };
}

export function fuelDriverDto(driver: Driver): FuelDriverDto {
  return { publicId: driver.publicId.toString(), name: driver.name.toString() };
}

export function fuelVehicleDto(vehicle: Vehicle): FuelVehicleDto {
  return {
    publicId: vehicle.publicId.toString(),
    plateNumber: vehicle.plateNumber.toString(),
    modelBrand: vehicle.modelBrand.toString(),
    vehicleType: vehicle.vehicleType.toString(),
  };
}

export function fuelAllocationDto(
  allocation: BudgetAllocation,
  office: Office,
): BudgetAllocationOperationalOptionDto {
  return {
    publicId: allocation.publicId.toString(),
    ppmpNumber: allocation.ppmpNumber.toString(),
    office: {
      publicId: office.publicId.toString(),
      name: office.name.toString(),
      abbreviation: office.abbreviation.toString(),
    },
    quarter: allocation.quarter.toNumber(),
    fiscalYear: allocation.fiscalYear.toNumber(),
  };
}

export function asFuelBusinessRule<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof DomainError) throw new BusinessRuleError(error.message);
    throw error;
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

export function assertEligibleAllocation(input: {
  readonly allocation: BudgetAllocation;
  readonly office: Office;
  readonly entryDate: EntryDate;
  readonly fiscalPeriodPolicy: FiscalPeriodPolicy;
}): void {
  if (!input.allocation.isOperationalState() || !input.office.isOperational()) {
    throw new BusinessRuleError('The selected budget allocation is not operational.');
  }
  const period = input.fiscalPeriodPolicy.resolveCivilDate(input.entryDate.toString());
  if (
    input.allocation.fiscalYear.toNumber() !== period.fiscalYear ||
    input.allocation.quarter.toNumber() !== period.quarter
  ) {
    throw new BusinessRuleError(
      'The selected budget allocation is not eligible for the entry date.',
    );
  }
}
