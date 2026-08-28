import {
  toDispatchDetailDto,
  type DispatchDetailDto,
  type DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import {
  buildDispatchAuditEvent,
  dispatchAuditSnapshot,
} from '@/application/dispatch/services/dispatch-audit-events';
import {
  asDispatchBusinessRule,
  assertOperationalDriver,
  assertOperationalOffice,
  assertOperationalVehicle,
  dispatchDriverDto,
  dispatchOfficeDto,
  dispatchVehicleDto,
} from '@/application/dispatch/services/dispatch-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class DispatchVehicle {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanUpdate(input.context.principal);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const dispatch = await repositories.dispatches.findByPublicIdForUpdate(input.publicId);
      if (dispatch === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanUpdate(input.context.principal, dispatch);
      const before = dispatchAuditSnapshot(dispatch);

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

      asDispatchBusinessRule(() => dispatch.markDispatched(at));
      await repositories.dispatches.updateLifecycle(dispatch);
      await repositories.auditEvents.append(
        buildDispatchAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'dispatched',
          entityPublicId: dispatch.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          before,
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
