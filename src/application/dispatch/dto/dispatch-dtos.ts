import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { DriverOperationalOptionDto } from '@/application/driver/dto/driver-dtos';
import type { OfficeOperationalOptionDto } from '@/application/office/dto/office-dtos';
import type { VehicleOperationalOptionDto } from '@/application/vehicle/dto/vehicle-dtos';
import type { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import type { DispatchConflictPolicyValue } from '@/domain/dispatch/value-objects/dispatch-conflict-policy';
import type { DispatchConflictTypeValue } from '@/domain/dispatch/value-objects/dispatch-conflict-type';
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
  readonly conflictAcknowledgments?: readonly DispatchConflictOverrideHistoryDto[];
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
  readonly conflictOverride?: DispatchConflictOverrideCommand | undefined;
}

export type CreateDispatchCommand = DispatchDetailsCommand;
export type UpdateDraftDispatchCommand = DispatchDetailsCommand;

export interface CompleteDispatchCommand {
  readonly odoAfter: string;
}

export interface DispatchVehicleCommand {
  readonly conflictOverride?: DispatchConflictOverrideCommand | undefined;
}

export interface CancelDispatchCommand {
  readonly reason: string;
}

export interface DispatchConflictOverrideCommand {
  readonly acknowledged: true;
  readonly reason: string;
  readonly fingerprint: string;
}

export interface DispatchScheduleCandidateDto {
  readonly travelDate: string;
  readonly driverPublicId: string;
  readonly vehiclePublicId: string;
  readonly excludedDispatchPublicId: string | null;
}

export interface DispatchScheduleConflictDto {
  readonly dispatchPublicId: string;
  readonly conflictType: DispatchConflictTypeValue;
  readonly travelDate: string;
  readonly status: DispatchStatusValue;
  readonly destination: string;
  readonly purpose: string;
  readonly driver: DispatchDriverDto;
  readonly vehicle: DispatchVehicleDto;
}

export interface DispatchScheduleConflictContextDto {
  readonly policy: DispatchConflictPolicyValue;
  readonly canOverride: boolean;
  readonly fingerprint: string;
  readonly conflicts: readonly DispatchScheduleConflictDto[];
}

export interface DispatchConflictFingerprintInputDto {
  readonly schemaVersion: 1;
  readonly policy: DispatchConflictPolicyValue;
  readonly settingsUpdatedAt: string;
  readonly candidate: DispatchScheduleCandidateDto;
  readonly conflicts: readonly Pick<
    DispatchScheduleConflictDto,
    'dispatchPublicId' | 'conflictType'
  >[];
}

export interface DispatchScheduleSettingsDto {
  readonly policy: DispatchConflictPolicyValue;
  readonly updatedByActorPublicId: string | null;
  readonly updatedAt: string;
}

export interface UpdateDispatchScheduleSettingsCommand {
  readonly policy: DispatchConflictPolicyValue;
}

export type DispatchScheduleView = 'day' | 'week' | 'month';

export interface DispatchScheduleQuery {
  readonly from: string;
  readonly to: string;
  readonly requestingOfficePublicId: string | null;
  readonly driverPublicId: string | null;
  readonly vehiclePublicId: string | null;
  readonly status: DispatchStatusValue | null;
  readonly limit: number;
}

export interface DispatchScheduleEventDto {
  readonly dispatchPublicId: string;
  readonly travelDate: string;
  readonly status: DispatchStatusValue;
  readonly destination: string;
  readonly purpose: string;
  readonly driver: DispatchDriverDto;
  readonly vehicle: DispatchVehicleDto;
  readonly requestingOffice: DispatchOfficeDto;
}

export interface DispatchResourceOccupancyDto {
  readonly resourceType: 'DRIVER' | 'VEHICLE';
  readonly resourcePublicId: string;
  readonly travelDate: string;
  readonly dispatchCount: number;
  readonly hasConflict: boolean;
}

export interface DispatchScheduleResultDto {
  readonly from: string;
  readonly to: string;
  readonly events: readonly DispatchScheduleEventDto[];
  readonly occupancy: readonly DispatchResourceOccupancyDto[];
  readonly truncated: boolean;
}

export interface DispatchConflictOverrideWriteDto {
  readonly publicId: string;
  readonly dispatchPublicId: string;
  readonly conflictingDispatchPublicId: string;
  readonly conflictType: DispatchConflictTypeValue;
  readonly policy: DispatchConflictPolicyValue;
  readonly reason: string;
  readonly acknowledgedByActorPublicId: string;
  readonly acknowledgedAt: string;
}

export interface DispatchConflictEvidenceQueryDto {
  readonly dispatchPublicId: string;
  readonly conflictingDispatchPublicId: string;
  readonly conflictType: DispatchConflictTypeValue;
}

export interface DispatchConflictOverrideHistoryDto {
  readonly publicId: string;
  readonly conflictingDispatchPublicId: string;
  readonly conflictingDispatchLabel: string;
  readonly conflictType: DispatchConflictTypeValue;
  readonly policy: DispatchConflictPolicyValue;
  readonly reason: string;
  readonly acknowledgedByActorPublicId: string;
  readonly acknowledgedAt: string;
}

export interface DispatchPreparationOptionsDto {
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly drivers: readonly DriverOperationalOptionDto[];
  readonly vehicles: readonly VehicleOperationalOptionDto[];
}

export interface DispatchFilterOptionsDto {
  readonly offices: readonly OfficeOperationalOptionDto[];
  readonly drivers: readonly DriverOperationalOptionDto[];
  readonly vehicles: readonly VehicleOperationalOptionDto[];
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
