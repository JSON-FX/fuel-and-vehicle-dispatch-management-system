import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import type { CreateOfficeCommand, OfficeAdminDto } from '@/application/office/dto/office-dtos';
import { toOfficeAdminDto } from '@/application/office/dto/office-dtos';
import { Office } from '@/domain/office/entities/office';
import { OfficeAbbreviation } from '@/domain/office/value-objects/office-abbreviation';
import { OfficeName } from '@/domain/office/value-objects/office-name';

export class CreateOffice {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly command: CreateOfficeCommand;
  }): Promise<OfficeAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    const at = this.dependencies.clock.now();
    const office = new Office({
      publicId: this.dependencies.publicIds.generate(),
      name: OfficeName.from(input.command.name),
      abbreviation: OfficeAbbreviation.from(input.command.abbreviation),
      createdAt: at,
      updatedAt: at,
    });

    await this.dependencies.transaction.execute(async (repositories) => {
      await repositories.offices.insert(office);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'office',
          action: 'created',
          entityPublicId: office.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          after: officeSnapshot(office),
        }),
      );
    });

    return toOfficeAdminDto(office);
  }
}

export function officeSnapshot(office: Office): Readonly<Record<string, string>> {
  return Object.freeze({
    name: office.name.toString(),
    abbreviation: office.abbreviation.toString(),
    status: office.status.toString(),
  });
}
