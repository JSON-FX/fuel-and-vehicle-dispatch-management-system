import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { vehicleSnapshot } from '@/application/vehicle/use-cases/create-vehicle';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class SoftDeleteVehicle {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly reason: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    const reason = input.reason.trim().replaceAll(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500) {
      throw new ValidationError([
        { field: 'reason', reason: 'Provide a reason containing 10 to 500 characters.' },
      ]);
    }
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(input.publicId);
      if (vehicle === null) throw new NotFoundError();
      const before = vehicleSnapshot(vehicle);
      vehicle.softDelete({
        at,
        actorPublicId: PublicId.from(input.context.principal.userPublicId),
        reason,
      });
      await repositories.vehicles.softDelete(vehicle);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'vehicle',
          action: 'deleted',
          entityPublicId: vehicle.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'soft_delete',
          before,
          metadata: { reason },
        }),
      );
    });
  }
}
