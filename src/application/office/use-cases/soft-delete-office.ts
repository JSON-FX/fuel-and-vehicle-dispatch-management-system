import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { officeSnapshot } from '@/application/office/use-cases/create-office';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class SoftDeleteOffice {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly reason: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    const reason = input.reason.trim().replaceAll(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500) {
      throw new ValidationError([
        { field: 'reason', reason: 'Provide a reason containing 10 to 500 characters.' },
      ]);
    }
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(input.publicId);
      if (office === null) throw new NotFoundError();
      const before = officeSnapshot(office);
      office.softDelete({
        at,
        actorPublicId: PublicId.from(input.context.principal.userPublicId),
        reason,
      });
      await repositories.offices.softDelete(office);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'office',
          action: 'deleted',
          entityPublicId: office.publicId.toString(),
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
