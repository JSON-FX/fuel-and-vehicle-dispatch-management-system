import type {
  VehicleListQuery,
  VehicleOperationalPage,
  VehiclePage,
} from '@/application/vehicle/dto/vehicle-dtos';
import type { Vehicle } from '@/domain/vehicle/entities/vehicle';

export interface VehicleRepository {
  findCurrentByPublicId(publicId: string): Promise<Vehicle | null>;
  findIncludingDeletedByPublicId(publicId: string): Promise<Vehicle | null>;
  findCurrentByPublicIdForUpdate(publicId: string): Promise<Vehicle | null>;
  findDeletedByPublicIdForUpdate(publicId: string): Promise<Vehicle | null>;
  insert(vehicle: Vehicle): Promise<void>;
  updateDetails(vehicle: Vehicle): Promise<void>;
  updateStatus(vehicle: Vehicle): Promise<void>;
  softDelete(vehicle: Vehicle): Promise<void>;
  restore(vehicle: Vehicle): Promise<void>;
  listAdmin(query: VehicleListQuery): Promise<VehiclePage>;
  listOperational(query: VehicleListQuery): Promise<VehicleOperationalPage>;
}
