import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';
import type { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import type { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';
import type { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import type { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

export interface VehicleProperties {
  readonly publicId: PublicId;
  modelBrand: ModelBrand;
  vehicleType: VehicleType;
  plateNumber: PlateNumber;
  remarks: VehicleRemarks | null;
  status?: VehicleStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedByActorPublicId?: PublicId | null;
  deleteReason?: string | null;
}

export class Vehicle {
  readonly publicId: PublicId;
  modelBrand: ModelBrand;
  vehicleType: VehicleType;
  plateNumber: PlateNumber;
  remarks: VehicleRemarks | null;
  status: VehicleStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByActorPublicId: PublicId | null;
  deleteReason: string | null;

  constructor(properties: VehicleProperties) {
    this.publicId = properties.publicId;
    this.modelBrand = properties.modelBrand;
    this.vehicleType = properties.vehicleType;
    this.plateNumber = properties.plateNumber;
    this.remarks = properties.remarks;
    this.status = properties.status ?? VehicleStatus.serviceable();
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.deletedAt = properties.deletedAt ?? null;
    this.deletedByActorPublicId = properties.deletedByActorPublicId ?? null;
    this.deleteReason = properties.deleteReason ?? null;
  }

  isOperational(): boolean {
    return this.deletedAt === null && this.status.isServiceable();
  }

  updateDetails(
    input: {
      modelBrand: ModelBrand;
      vehicleType: VehicleType;
      plateNumber: PlateNumber;
      remarks: VehicleRemarks | null;
    },
    at: Date,
  ): void {
    this.assertCurrent();
    this.modelBrand = input.modelBrand;
    this.vehicleType = input.vehicleType;
    this.plateNumber = input.plateNumber;
    this.remarks = input.remarks;
    this.updatedAt = at;
  }

  changeStatus(status: VehicleStatus, at: Date): void {
    this.assertCurrent();
    this.status = status;
    this.updatedAt = at;
  }

  softDelete(input: { at: Date; actorPublicId: PublicId; reason: string }): void {
    this.assertCurrent();
    this.deletedAt = input.at;
    this.deletedByActorPublicId = input.actorPublicId;
    this.deleteReason = input.reason;
    this.updatedAt = input.at;
  }

  restore(at: Date): void {
    if (this.deletedAt === null) {
      throw new DomainError('VEHICLE_NOT_DELETED', 'Vehicle is not deleted.');
    }
    this.deletedAt = null;
    this.deletedByActorPublicId = null;
    this.deleteReason = null;
    this.status = VehicleStatus.unserviceable();
    this.updatedAt = at;
  }

  private assertCurrent(): void {
    if (this.deletedAt !== null) {
      throw new DomainError('VEHICLE_DELETED', 'Deleted vehicles cannot be changed.');
    }
  }
}
