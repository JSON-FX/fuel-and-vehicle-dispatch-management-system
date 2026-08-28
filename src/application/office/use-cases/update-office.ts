import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import {
  toOfficeAdminDto,
  type OfficeAdminDto,
  type UpdateOfficeCommand,
} from '@/application/office/dto/office-dtos';
import { officeSnapshot } from '@/application/office/use-cases/create-office';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';
import { OfficeStatus } from '@/domain/office/value-objects/office-status';

export class UpdateOffice {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly command: UpdateOfficeCommand;
  }): Promise<OfficeAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    const at = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(input.publicId);
      if (office === null) throw new NotFoundError();
      const before = officeSnapshot(office);
      const nextName = OfficeName.from(input.command.name ?? office.name.toString());
      const nextAbbreviation = OfficeAbbreviation.from(
        input.command.abbreviation ?? office.abbreviation.toString(),
      );
      const detailsChanged =
        nextName.toString() !== office.name.toString() ||
        nextAbbreviation.toString() !== office.abbreviation.toString();
      const nextStatus = OfficeStatus.from(input.command.status ?? office.status.toString());
      const statusChanged = nextStatus.toString() !== office.status.toString();

      if (detailsChanged) {
        office.updateDetails(nextName, nextAbbreviation, at);
        await repositories.offices.updateDetails(office);
        await repositories.auditEvents.append(
          this.audit(
            input,
            office.publicId.toString(),
            'updated',
            at,
            before,
            officeSnapshot(office),
          ),
        );
      }
      if (statusChanged) {
        const previousStatus = office.status.toString();
        office.changeStatus(nextStatus, at);
        await repositories.offices.updateStatus(office);
        await repositories.auditEvents.append(
          this.audit(input, office.publicId.toString(), 'status_changed', at, null, null, {
            previousStatus,
            nextStatus: office.status.toString(),
          }),
        );
      }
      return toOfficeAdminDto(office);
    });
  }

  private audit(
    input: {
      readonly context: MasterDataRequestContext;
    },
    entityPublicId: string,
    action: 'updated' | 'status_changed',
    occurredAt: Date,
    before: unknown,
    after: unknown,
    metadata: unknown = null,
  ) {
    return buildMasterDataAuditEvent({
      publicId: this.dependencies.publicIds.generate().toString(),
      resource: 'office',
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
