import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import {
  buildMasterDataAuditEvent,
  driverAuditSnapshot,
} from '@/application/master-data/services/master-data-audit-events';
import {
  toDriverAdminDto,
  type CreateDriverCommand,
  type DriverAdminDto,
} from '@/application/driver/dto/driver-dtos';
import { Driver } from '@/domain/driver/entities/driver';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';

export class CreateDriver {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly command: CreateDriverCommand;
  }): Promise<DriverAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    const at = this.dependencies.clock.now();
    const driver = new Driver({
      publicId: this.dependencies.publicIds.generate(),
      name: DriverName.from(input.command.name),
      contactNumber: DriverContactNumber.optional(input.command.contactNumber),
      createdAt: at,
      updatedAt: at,
    });

    await this.dependencies.transaction.execute(async (repositories) => {
      await repositories.drivers.insert(driver);
      await repositories.auditEvents.append(
        buildMasterDataAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          resource: 'driver',
          action: 'created',
          entityPublicId: driver.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          after: driverSnapshot(driver),
        }),
      );
    });
    return toDriverAdminDto(driver);
  }
}

export function driverSnapshot(driver: Driver): Readonly<Record<string, string | boolean>> {
  return driverAuditSnapshot({
    name: driver.name.toString(),
    status: driver.status.toString(),
    contactNumber: driver.contactNumber?.toString() ?? null,
  });
}
