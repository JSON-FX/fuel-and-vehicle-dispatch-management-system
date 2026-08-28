import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { officeSnapshot } from '@/application/office/use-cases/create-office';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class RestoreOffice {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findDeletedByPublicIdForUpdate(input.publicId);
      if (office === null) throw new NotFoundError();
      const before = officeSnapshot(office);
      office.restore(at);
      await repositories.offices.restore(office);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'office',
          action: 'restored',
          entityPublicId: office.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'restore',
          before,
          after: officeSnapshot(office),
        }),
      );
    });
  }
}
