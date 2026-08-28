import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { vehicleSnapshot } from '@/application/vehicle/use-cases/create-vehicle';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class RestoreVehicle {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const vehicle = await repositories.vehicles.findDeletedByPublicIdForUpdate(input.publicId);
      if (vehicle === null) throw new NotFoundError();
      const before = vehicleSnapshot(vehicle);
      vehicle.restore(at);
      await repositories.vehicles.restore(vehicle);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'vehicle',
          action: 'restored',
          entityPublicId: vehicle.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'restore',
          before,
          after: vehicleSnapshot(vehicle),
        }),
      );
    });
  }
}
