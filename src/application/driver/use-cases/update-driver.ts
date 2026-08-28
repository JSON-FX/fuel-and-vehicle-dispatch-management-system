import type { DriverAdminDto, UpdateDriverCommand } from '@/application/driver/dto/driver-dtos';
import { toDriverAdminDto } from '@/application/driver/dto/driver-dtos';
import { driverSnapshot } from '@/application/driver/use-cases/create-driver';
import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { buildMasterDataAuditEvent } from '@/application/master-data/services/master-data-audit-events';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { DriverContactNumber } from '@/domain/driver/value-objects/driver-contact-number';
import { DriverName } from '@/domain/driver/value-objects/driver-name';
import { DriverStatus } from '@/domain/driver/value-objects/driver-status';

export class UpdateDriver {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
    readonly command: UpdateDriverCommand;
  }): Promise<DriverAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(input.publicId);
      if (driver === null) throw new NotFoundError();
      const before = driverSnapshot(driver);
      const previousContact = driver.contactNumber?.toString() ?? null;
      const nextName = DriverName.from(input.command.name ?? driver.name.toString());
      const nextContact =
        input.command.contactNumber === undefined
          ? driver.contactNumber
          : DriverContactNumber.optional(input.command.contactNumber);
      const detailsChanged =
        nextName.toString() !== driver.name.toString() ||
        (nextContact?.toString() ?? null) !== previousContact;
      const nextStatus = DriverStatus.from(input.command.status ?? driver.status.toString());
      const statusChanged = nextStatus.toString() !== driver.status.toString();

      if (detailsChanged) {
        driver.updateDetails(nextName, nextContact, at);
        await repositories.drivers.updateDetails(driver);
        await repositories.auditEvents.append(
          this.audit(
            input,
            driver.publicId.toString(),
            'updated',
            at,
            before,
            driverSnapshot(driver),
            {
              contactNumberChanged: (nextContact?.toString() ?? null) !== previousContact,
            },
          ),
        );
      }
      if (statusChanged) {
        const previousStatus = driver.status.toString();
        driver.changeStatus(nextStatus, at);
        await repositories.drivers.updateStatus(driver);
        await repositories.auditEvents.append(
          this.audit(input, driver.publicId.toString(), 'status_changed', at, null, null, {
            previousStatus,
            nextStatus: driver.status.toString(),
          }),
        );
      }
      return toDriverAdminDto(driver);
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
      resource: 'driver',
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
