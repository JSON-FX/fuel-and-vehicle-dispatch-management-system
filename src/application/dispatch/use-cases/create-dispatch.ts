import {
  toDispatchDetailDto,
  type CreateDispatchCommand,
  type DispatchDetailDto,
  type DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import {
  buildDispatchAuditEvent,
  dispatchAuditSnapshot,
} from '@/application/dispatch/services/dispatch-audit-events';
import {
  assertOperationalDriver,
  assertOperationalOffice,
  assertOperationalVehicle,
  dispatchDetails,
  dispatchDriverDto,
  dispatchOfficeDto,
  dispatchVehicleDto,
} from '@/application/dispatch/services/dispatch-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class CreateDispatch {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly command: CreateDispatchCommand;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanCreate(input.context.principal);
    const details = dispatchDetails(input.command);
    const at = this.dependencies.clock.now();
    const dispatch = new VehicleDispatch({
      publicId: this.dependencies.publicIds.generate(),
      ...details,
      createdByActorPublicId: PublicId.from(input.context.principal.userPublicId),
      createdAt: at,
      updatedAt: at,
    });

    return this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        dispatch.requestingOfficePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertOperationalOffice(office);

      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(
        dispatch.driverPublicId.toString(),
      );
      if (driver === null) throw new NotFoundError();
      assertOperationalDriver(driver);

      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(
        dispatch.vehiclePublicId.toString(),
      );
      if (vehicle === null) throw new NotFoundError();
      assertOperationalVehicle(vehicle);

      await repositories.dispatches.insert(dispatch);
      await repositories.auditEvents.append(
        buildDispatchAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'created',
          entityPublicId: dispatch.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          after: dispatchAuditSnapshot(dispatch),
        }),
      );

      return toDispatchDetailDto({
        dispatch,
        requestingOffice: dispatchOfficeDto(office),
        driver: dispatchDriverDto(driver),
        vehicle: dispatchVehicleDto(vehicle),
      });
    });
  }
}
