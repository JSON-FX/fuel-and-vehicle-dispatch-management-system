import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import {
  toVehicleAdminDto,
  type UpdateVehicleCommand,
  type VehicleAdminDto,
} from '@/application/vehicle/dto/vehicle-dtos';
import { vehicleSnapshot } from '@/application/vehicle/use-cases/create-vehicle';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { ModelBrand } from '@/domain/vehicle/value-objects/model-brand';
import { PlateNumber } from '@/domain/vehicle/value-objects/plate-number';
import { VehicleRemarks } from '@/domain/vehicle/value-objects/vehicle-remarks';
import { VehicleStatus } from '@/domain/vehicle/value-objects/vehicle-status';
import { VehicleType } from '@/domain/vehicle/value-objects/vehicle-type';

export class UpdateVehicle {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly command: UpdateVehicleCommand;
  }): Promise<VehicleAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(input.publicId);
      if (vehicle === null) throw new NotFoundError();
      const before = vehicleSnapshot(vehicle);
      const nextDetails = {
        modelBrand: ModelBrand.from(input.command.modelBrand ?? vehicle.modelBrand.toString()),
        vehicleType: VehicleType.from(input.command.vehicleType ?? vehicle.vehicleType.toString()),
        plateNumber: PlateNumber.from(input.command.plateNumber ?? vehicle.plateNumber.toString()),
        remarks:
          input.command.remarks === undefined
            ? vehicle.remarks
            : VehicleRemarks.optional(input.command.remarks),
      };
      const detailsChanged =
        nextDetails.modelBrand.toString() !== vehicle.modelBrand.toString() ||
        nextDetails.vehicleType.toString() !== vehicle.vehicleType.toString() ||
        nextDetails.plateNumber.toString() !== vehicle.plateNumber.toString() ||
        (nextDetails.remarks?.toString() ?? null) !== (vehicle.remarks?.toString() ?? null);
      const nextStatus = VehicleStatus.from(input.command.status ?? vehicle.status.toString());
      const statusChanged = nextStatus.toString() !== vehicle.status.toString();

      if (detailsChanged) {
        vehicle.updateDetails(nextDetails, at);
        await repositories.vehicles.updateDetails(vehicle);
        await repositories.auditEvents.append(
          this.audit(
            input,
            vehicle.publicId.toString(),
            'updated',
            at,
            before,
            vehicleSnapshot(vehicle),
            null,
          ),
        );
      }
      if (statusChanged) {
        const previousStatus = vehicle.status.toString();
        vehicle.changeStatus(nextStatus, at);
        await repositories.vehicles.updateStatus(vehicle);
        await repositories.auditEvents.append(
          this.audit(input, vehicle.publicId.toString(), 'status_changed', at, null, null, {
            previousStatus,
            nextStatus: vehicle.status.toString(),
          }),
        );
      }
      return toVehicleAdminDto(vehicle);
    });
  }

  private audit(
    input: { readonly context: MasterDataRequestContext },
    entityPublicId: string,
    action: 'updated' | 'status_changed',
    occurredAt: Date,
    before: unknown,
    after: unknown,
    metadata: unknown,
  ) {
    return buildMasterDataAuditEvent({
      publicId: this.dependencies.publicIds.generate().toString(),
      resource: 'vehicle',
      action,
      entityPublicId,
      actorPublicId: input.context.principal.userPublicId,
      requestId: input.context.requestId,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      occurredAt,
      before,
      after,
      metadata,
    });
  }
}
