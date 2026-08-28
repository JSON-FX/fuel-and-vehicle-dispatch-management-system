import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { DriverOperationalOptionDto } from '@/application/driver/dto/driver-dtos';
import type { OfficeOperationalOptionDto } from '@/application/office/dto/office-dtos';
import type { VehicleOperationalOptionDto } from '@/application/vehicle/dto/vehicle-dtos';
import type { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import type { DispatchStatusValue } from '@/domain/dispatch/value-objects/dispatch-status';

export interface DispatchRequestContext {
  readonly principal: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface DispatchDriverDto {
  readonly publicId: string;
  readonly name: string;
}

export interface DispatchVehicleDto {
  readonly publicId: string;
  readonly plateNumber: string;
  readonly modelBrand: string;
  readonly vehicleType: string;
}

export interface DispatchOfficeDto {
  readonly publicId: string;
  readonly name: string;
  readonly abbreviation: string;
}

export interface DispatchDetailDto {
  readonly publicId: string;
  readonly entryDate: string;
  readonly travelDate: string;
  readonly driver: DispatchDriverDto;
  readonly vehicle: DispatchVehicleDto;
  readonly requestingOffice: DispatchOfficeDto;
  readonly destination: string;
  readonly purpose: string;
  readonly odoBefore: string;
  readonly odoAfter: string | null;
  readonly distance: string | null;
  readonly passengerCount: number;
  readonly status: DispatchStatusValue;
  readonly createdByActorPublicId: string;
  readonly dispatchedAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly cancelledByActorPublicId: string | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DispatchReferenceRecord {
  readonly dispatch: VehicleDispatch;
  readonly driver: DispatchDriverDto;
  readonly vehicle: DispatchVehicleDto;
  readonly requestingOffice: DispatchOfficeDto;
}

export interface DispatchListQuery {
  readonly query: string | null;
  readonly status: DispatchStatusValue | null;
  readonly requestingOfficePublicId: string | null;
  readonly travelDateFrom: string | null;
  readonly travelDateTo: string | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface DispatchCursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
}

export type DispatchPage = DispatchCursorPage<DispatchDetailDto>;
export type DispatchRecordPage = DispatchCursorPage<DispatchReferenceRecord>;

export interface DispatchDetailsCommand {
  readonly entryDate: string;
  readonly travelDate: string;
  readonly driverPublicId: string;
  readonly vehiclePublicId: string;
  readonly requestingOfficePublicId: string;
  readonly destination: string;
  readonly purpose: string;
  readonly odoBefore: string;
  readonly passengerCount: number;
}

export type CreateDispatchCommand = DispatchDetailsCommand;
export type UpdateDraftDispatchCommand = DispatchDetailsCommand;

export interface CompleteDispatchCommand {
  readonly odoAfter: string;
}

export interface CancelDispatchCommand {
  readonly reason: string;
}

export interface DispatchPreparationOptionsDto {
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly drivers: readonly DriverOperationalOptionDto[];
  readonly vehicles: readonly VehicleOperationalOptionDto[];
}

export interface DispatchFilterOptionsDto {
  readonly offices: readonly OfficeOperationalOptionDto[];
}

export function toDispatchDetailDto(record: DispatchReferenceRecord): DispatchDetailDto {
  const { dispatch } = record;
  return {
    publicId: dispatch.publicId.toString(),
    entryDate: dispatch.entryDate.toString(),
    travelDate: dispatch.travelDate.toString(),
    driver: record.driver,
    vehicle: record.vehicle,
    requestingOffice: record.requestingOffice,
    destination: dispatch.destination,
    purpose: dispatch.purpose,
    odoBefore: dispatch.odoBefore.toString(),
    odoAfter: dispatch.odoAfter?.toString() ?? null,
    distance: dispatch.distance,
    passengerCount: dispatch.passengerCount.toNumber(),
    status: dispatch.status.toString(),
    createdByActorPublicId: dispatch.createdByActorPublicId.toString(),
    dispatchedAt: dispatch.dispatchedAt?.toISOString() ?? null,
    completedAt: dispatch.completedAt?.toISOString() ?? null,
    cancelledAt: dispatch.cancelledAt?.toISOString() ?? null,
    cancelledByActorPublicId: dispatch.cancelledByActorPublicId?.toString() ?? null,
    cancellationReason: dispatch.cancellationReason,
    createdAt: dispatch.createdAt.toISOString(),
    updatedAt: dispatch.updatedAt.toISOString(),
  };
}
