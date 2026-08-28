import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import {
  toVehicleAdminDto,
  type CreateVehicleCommand,
  type VehicleAdminDto,
} from '@/application/vehicle/dto/vehicle-dtos';
import { Vehicle } from '@/domain/vehicle/entities/vehicle';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

export class CreateVehicle {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly command: CreateVehicleCommand;
  }): Promise<VehicleAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    const at = this.dependencies.clock.now();
    const vehicle = new Vehicle({
      publicId: this.dependencies.publicIds.generate(),
      modelBrand: ModelBrand.from(input.command.modelBrand),
      vehicleType: VehicleType.from(input.command.vehicleType),
      plateNumber: PlateNumber.from(input.command.plateNumber),
      remarks: VehicleRemarks.optional(input.command.remarks),
      createdAt: at,
      updatedAt: at,
    });
    await this.dependencies.transaction.execute(async (repositories) => {
      await repositories.vehicles.insert(vehicle);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'vehicle',
          action: 'created',
          entityPublicId: vehicle.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          after: vehicleSnapshot(vehicle),
        }),
      );
    });
    return toVehicleAdminDto(vehicle);
  }
}

export function vehicleSnapshot(vehicle: Vehicle): Readonly<Record<string, string | null>> {
  return Object.freeze({
    modelBrand: vehicle.modelBrand.toString(),
    vehicleType: vehicle.vehicleType.toString(),
    plateNumber: vehicle.plateNumber.toString(),
    status: vehicle.status.toString(),
    remarks: vehicle.remarks?.toString() ?? null,
  });
}
