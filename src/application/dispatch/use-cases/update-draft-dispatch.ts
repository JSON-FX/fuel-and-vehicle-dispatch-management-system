import {
  toDispatchDetailDto,
  type DispatchDetailDto,
  type DispatchRequestContext,
  type UpdateDraftDispatchCommand,
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
  dispatchDetails,
  dispatchDriverDto,
  dispatchOfficeDto,
  dispatchVehicleDto,
} from '@/application/dispatch/services/dispatch-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class UpdateDraftDispatch {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
    readonly command: UpdateDraftDispatchCommand;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanUpdate(input.context.principal);
    const details = dispatchDetails(input.command);
    const at = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        details.requestingOfficePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertOperationalOffice(office);
      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(
        details.driverPublicId.toString(),
      );
      if (driver === null) throw new NotFoundError();
      assertOperationalDriver(driver);
      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(
        details.vehiclePublicId.toString(),
      );
      if (vehicle === null) throw new NotFoundError();
      assertOperationalVehicle(vehicle);

      const dispatch = await repositories.dispatches.findByPublicIdForUpdate(input.publicId);
      if (dispatch === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanUpdate(input.context.principal, dispatch);
      const before = dispatchAuditSnapshot(dispatch);

      const scheduleSettings = await repositories.dispatchScheduleSettings.getForShare();
      const candidate = {
        travelDate: details.travelDate.toString(),
        driverPublicId: details.driverPublicId.toString(),
        vehiclePublicId: details.vehiclePublicId.toString(),
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
        command: input.command.conflictOverride,
        dispatchPublicId: dispatch.publicId.toString(),
        allowExistingEvidence: false,
        overrides: repositories.dispatchConflictOverrides,
        at,
      });

      asDispatchBusinessRule(() => dispatch.updateDetails(details, at));
      await repositories.dispatches.updateDetails(dispatch);
      await repositories.dispatchConflictOverrides.appendMany(resolution.overrideRows);
      await repositories.auditEvents.append(
        buildDispatchAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'updated',
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
