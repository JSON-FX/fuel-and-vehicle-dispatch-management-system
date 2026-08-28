import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { BudgetAllocationOperationalOptionDto } from '@/application/budget/dto/budget-allocation-dtos';
import type { DriverOperationalOptionDto } from '@/application/driver/dto/driver-dtos';
import type { VehicleOperationalOptionDto } from '@/application/vehicle/dto/vehicle-dtos';
import type { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import type { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import type { FuelIssuanceStatusValue } from '@/domain/fuel/value-objects/fuel-issuance-status';
import type { FuelTypeValue } from '@/domain/fuel/value-objects/fuel-type';

export interface FuelRequestContext {
  readonly principal: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface FuelDriverDto {
  readonly publicId: string;
  readonly name: string;
}

export interface FuelVehicleDto {
  readonly publicId: string;
  readonly plateNumber: string;
  readonly modelBrand: string;
  readonly vehicleType: string;
}

export interface FuelLedgerEntryDto {
  readonly publicId: string;
  readonly transactionType: 'OPENING' | 'RECEIPT' | 'ISSUANCE' | 'ADJUSTMENT';
  readonly fuelType: FuelTypeValue;
  readonly quantity: string;
  readonly signedQuantity: string;
  readonly effectiveDate: string;
  readonly reference: string;
  readonly createdAt: string;
}

export interface FuelIssuanceDto {
  readonly publicId: string;
  readonly risNumber: string | null;
  readonly purchaseRequestNumber: string;
  readonly entryDate: string;
  readonly driver: FuelDriverDto;
  readonly destination: string;
  readonly purpose: string;
  readonly vehicle: FuelVehicleDto;
  readonly requestedLiters: string | null;
  readonly isFullTank: boolean;
  readonly issuedLiters: string | null;
  readonly unitPrice: string;
  readonly totalAmount: string | null;
  readonly allocation: BudgetAllocationOperationalOptionDto;
  readonly fuelType: FuelTypeValue;
  readonly status: FuelIssuanceStatusValue;
  readonly createdByActorPublicId: string;
  readonly postedAt: string | null;
  readonly voidedAt: string | null;
  readonly voidedByActorPublicId: string | null;
  readonly voidReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FuelIssuanceDetailDto extends FuelIssuanceDto {
  readonly ledgerEntries: readonly FuelLedgerEntryDto[];
}

export interface FuelIssuanceReferenceRecord {
  readonly issuance: FuelIssuance;
  readonly driver: FuelDriverDto;
  readonly vehicle: FuelVehicleDto;
  readonly allocation: BudgetAllocationOperationalOptionDto;
}

export interface FuelIssuanceDetailRecord extends FuelIssuanceReferenceRecord {
  readonly ledgerEntries: readonly FuelLedgerEntry[];
}

export interface FuelIssuanceListQuery {
  readonly query: string | null;
  readonly status: FuelIssuanceStatusValue | null;
  readonly fuelType: FuelTypeValue | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface FuelCursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
}

export type FuelIssuancePage = FuelCursorPage<FuelIssuanceDto>;
export type FuelIssuanceRecordPage = FuelCursorPage<FuelIssuanceReferenceRecord>;

export interface FuelIssuanceDetailsCommand {
  readonly purchaseRequestNumber: string;
  readonly entryDate: string;
  readonly driverPublicId: string;
  readonly destination?: string | undefined;
  readonly purpose: string;
  readonly vehiclePublicId: string;
  readonly requestedLiters: string | null;
  readonly isFullTank: boolean;
  readonly issuedLiters?: string | null | undefined;
  readonly unitPrice: string;
  readonly budgetAllocationPublicId: string;
  readonly fuelType: FuelTypeValue;
}

export type CreateFuelIssuanceCommand = FuelIssuanceDetailsCommand;
export type UpdateDraftFuelIssuanceCommand = FuelIssuanceDetailsCommand;

export interface PostFuelIssuanceCommand {
  readonly issuedLiters: string;
}

export interface VoidFuelIssuanceCommand {
  readonly reason: string;
}

export interface FuelBalanceQuery {
  readonly startDate: string;
  readonly endDate: string;
  readonly fuelType: FuelTypeValue | null;
}

export interface FuelBalanceDto {
  readonly fuelType: FuelTypeValue;
  readonly startDate: string;
  readonly endDate: string;
  readonly opening: string;
  readonly receipts: string;
  readonly adjustments: string;
  readonly issuances: string;
  readonly netMovement: string;
  readonly closing: string;
}

export interface FuelPreparationOptionsDto {
  readonly drivers: readonly DriverOperationalOptionDto[];
  readonly vehicles: readonly VehicleOperationalOptionDto[];
  readonly allocations: readonly BudgetAllocationOperationalOptionDto[];
}

export function toFuelLedgerEntryDto(entry: FuelLedgerEntry): FuelLedgerEntryDto {
  return {
    publicId: entry.publicId.toString(),
    transactionType: entry.transactionType,
    fuelType: entry.fuelType.toString(),
    quantity: entry.quantity.toString(),
    signedQuantity: entry.signedQuantity.toString(),
    effectiveDate: entry.effectiveDate.toString(),
    reference: entry.reference,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toFuelIssuanceDto(record: FuelIssuanceReferenceRecord): FuelIssuanceDto {
  const { issuance } = record;
  return {
    publicId: issuance.publicId.toString(),
    risNumber: issuance.risNumber?.toString() ?? null,
    purchaseRequestNumber: issuance.purchaseRequestNumber.toString(),
    entryDate: issuance.entryDate.toString(),
    driver: record.driver,
    destination: issuance.destination,
    purpose: issuance.purpose,
    vehicle: record.vehicle,
    requestedLiters: issuance.requestedLiters?.toString() ?? null,
    isFullTank: issuance.isFullTank,
    issuedLiters: issuance.issuedLiters?.toString() ?? null,
    unitPrice: issuance.unitPrice.toString(),
    totalAmount: issuance.totalAmount?.toString() ?? null,
    allocation: record.allocation,
    fuelType: issuance.fuelType.toString(),
    status: issuance.status.toString(),
    createdByActorPublicId: issuance.createdByActorPublicId.toString(),
    postedAt: issuance.postedAt?.toISOString() ?? null,
    voidedAt: issuance.voidedAt?.toISOString() ?? null,
    voidedByActorPublicId: issuance.voidedByActorPublicId?.toString() ?? null,
    voidReason: issuance.voidReason,
    createdAt: issuance.createdAt.toISOString(),
    updatedAt: issuance.updatedAt.toISOString(),
  };
}

export function toFuelIssuanceDetailDto(record: FuelIssuanceDetailRecord): FuelIssuanceDetailDto {
  return {
    ...toFuelIssuanceDto(record),
    ledgerEntries: record.ledgerEntries.map(toFuelLedgerEntryDto),
  };
}
