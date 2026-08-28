import { driverSnapshot } from '@/application/driver/use-cases/create-driver';
import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class RestoreDriver {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const driver = await repositories.drivers.findDeletedByPublicIdForUpdate(input.publicId);
      if (driver === null) throw new NotFoundError();
      const before = driverSnapshot(driver);
      driver.restore(at);
      await repositories.drivers.restore(driver);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'driver',
          action: 'restored',
          entityPublicId: driver.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'restore',
          before,
          after: driverSnapshot(driver),
        }),
      );
    });
  }
}
