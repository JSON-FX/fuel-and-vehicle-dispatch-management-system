import {
  toDispatchDetailDto,
  type DispatchDetailDto,
  type DispatchRequestContext,
  type DispatchVehicleCommand,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import {
  buildDispatchAuditEvent,
  dispatchAuditSnapshot,
} from '@/application/dispatch/services/dispatch-audit-events';
import { DispatchConflictResolutionService } from '@/application/dispatch/services/dispatch-conflict-resolution';
import {
  asDispatchBusinessRule,
  assertOperationalDriver,
  assertOperationalOffice,
  assertOperationalVehicle,
  dispatchDriverDto,
  dispatchOfficeDto,
  dispatchVehicleDto,
} from '@/application/dispatch/services/dispatch-use-case-support';
import {
  DispatchTransactionRetryError,
  NotFoundError,
} from '@/application/shared/errors/application-error';

export class DispatchVehicle {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
    readonly command?: DispatchVehicleCommand;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanUpdate(input.context.principal);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const discovered = await repositories.dispatches.findByPublicId(input.publicId);
      if (discovered === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanUpdate(input.context.principal, discovered.dispatch);

      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        discovered.dispatch.requestingOfficePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertOperationalOffice(office);
      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(
        discovered.dispatch.driverPublicId.toString(),
      );
      if (driver === null) throw new NotFoundError();
      assertOperationalDriver(driver);
      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(
        discovered.dispatch.vehiclePublicId.toString(),
      );
      if (vehicle === null) throw new NotFoundError();
      assertOperationalVehicle(vehicle);

      const dispatch = await repositories.dispatches.findByPublicIdForUpdate(input.publicId);
      if (dispatch === null) throw new NotFoundError();
      if (
        dispatch.requestingOfficePublicId.toString() !==
          discovered.dispatch.requestingOfficePublicId.toString() ||
        dispatch.driverPublicId.toString() !== discovered.dispatch.driverPublicId.toString() ||
        dispatch.vehiclePublicId.toString() !== discovered.dispatch.vehiclePublicId.toString()
      ) {
        throw new DispatchTransactionRetryError();
      }
      this.dependencies.permissions.assertCanUpdate(input.context.principal, dispatch);
      const before = dispatchAuditSnapshot(dispatch);

      const scheduleSettings = await repositories.dispatchScheduleSettings.getForShare();
      const candidate = {
        travelDate: dispatch.travelDate.toString(),
        driverPublicId: dispatch.driverPublicId.toString(),
        vehiclePublicId: dispatch.vehiclePublicId.toString(),
        excludedDispatchPublicId: dispatch.publicId.toString(),
      };
      const conflicts =
        await repositories.dispatchSchedules.findCurrentConflictsForShare(candidate);
      const resolution = await new DispatchConflictResolutionService({
        permissions: this.dependencies.permissions,
        fingerprints: this.dependencies.conflictFingerprints,
        publicIds: this.dependencies.publicIds,
      }).resolve({
        context: input.context,
        candidate,
        settings: scheduleSettings,
        conflicts,
        command: input.command?.conflictOverride,
        dispatchPublicId: dispatch.publicId.toString(),
        allowExistingEvidence: true,
        overrides: repositories.dispatchConflictOverrides,
        at,
      });

      asDispatchBusinessRule(() => dispatch.markDispatched(at));
      await repositories.dispatches.updateLifecycle(dispatch);
      await repositories.dispatchConflictOverrides.appendMany(resolution.overrideRows);
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
      if (resolution.auditEvent !== null) {
        await repositories.auditEvents.append(resolution.auditEvent);
      }
      return toDispatchDetailDto({
        dispatch,
        requestingOffice: dispatchOfficeDto(office),
        driver: dispatchDriverDto(driver),
        vehicle: dispatchVehicleDto(vehicle),
      });
    });
  }
}
