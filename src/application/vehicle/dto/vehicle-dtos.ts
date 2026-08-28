import type {
  CursorPage,
  MasterDataListQuery,
} from '@/application/master-data/dto/master-data-list-dtos';
import type { Vehicle } from '@/domain/vehicle/entities/vehicle';

export type VehicleStatusDto = 'SERVICEABLE' | 'UNSERVICEABLE';

export interface VehicleAdminDto {
  readonly publicId: string;
  readonly modelBrand: string;
  readonly vehicleType: string;
  readonly plateNumber: string;
  readonly status: VehicleStatusDto;
  readonly remarks: string | null;
  readonly operational: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly deletedByActorPublicId: string | null;
  readonly deleteReason: string | null;
}

export interface VehicleOperationalOptionDto {
  readonly publicId: string;
  readonly label: string;
  readonly plateNumber: string;
}

export interface CreateVehicleCommand {
  readonly modelBrand: string;
  readonly vehicleType: string;
  readonly plateNumber: string;
  readonly remarks?: string | null | undefined;
}

export interface UpdateVehicleCommand {
  readonly modelBrand?: string | undefined;
  readonly vehicleType?: string | undefined;
  readonly plateNumber?: string | undefined;
  readonly status?: VehicleStatusDto | undefined;
  readonly remarks?: string | null | undefined;
}

export type VehicleListQuery = MasterDataListQuery;
export type VehiclePage = CursorPage<VehicleAdminDto>;
export type VehicleOperationalPage = CursorPage<VehicleOperationalOptionDto>;

export function toVehicleAdminDto(vehicle: Vehicle): VehicleAdminDto {
  return {
    publicId: vehicle.publicId.toString(),
    modelBrand: vehicle.modelBrand.toString(),
    vehicleType: vehicle.vehicleType.toString(),
    plateNumber: vehicle.plateNumber.toString(),
    status: vehicle.status.toString(),
    remarks: vehicle.remarks?.toString() ?? null,
    operational: vehicle.isOperational(),
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    deletedAt: vehicle.deletedAt?.toISOString() ?? null,
    deletedByActorPublicId: vehicle.deletedByActorPublicId?.toString() ?? null,
    deleteReason: vehicle.deleteReason,
  };
}
