import { driverSnapshot } from '@/application/driver/use-cases/create-driver';
import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class SoftDeleteDriver {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly reason: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    const reason = input.reason.trim().replaceAll(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500) {
      throw new ValidationError([
        { field: 'reason', reason: 'Provide a reason containing 10 to 500 characters.' },
      ]);
    }
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(input.publicId);
      if (driver === null) throw new NotFoundError();
      const before = driverSnapshot(driver);
      driver.softDelete({
        at,
        actorPublicId: PublicId.from(input.context.principal.userPublicId),
        reason,
      });
      await repositories.drivers.softDelete(driver);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'driver',
          action: 'deleted',
          entityPublicId: driver.publicId.toString(),
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
