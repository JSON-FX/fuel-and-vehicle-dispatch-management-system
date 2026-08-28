import {
  toFuelIssuanceDto,
  type FuelIssuanceDto,
  type FuelRequestContext,
  type UpdateDraftFuelIssuanceCommand,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import {
  buildFuelIssuanceAuditEvent,
  fuelIssuanceAuditSnapshot,
} from '@/application/fuel/services/fuel-audit-events';
import {
  asFuelBusinessRule,
  assertEligibleAllocation,
  assertOperationalDriver,
  assertOperationalVehicle,
  fuelAllocationDto,
  fuelDriverDto,
  fuelIssuanceDetails,
  fuelVehicleDto,
} from '@/application/fuel/services/fuel-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class UpdateDraftFuelIssuance {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly publicId: string;
    readonly command: UpdateDraftFuelIssuanceCommand;
  }): Promise<FuelIssuanceDto> {
    this.dependencies.permissions.assertCanCreate(input.context.principal);
    const details = fuelIssuanceDetails(input.command);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const issuance = await repositories.issuances.findByPublicIdForUpdate(input.publicId);
      if (issuance === null) throw new NotFoundError();
      const before = fuelIssuanceAuditSnapshot(issuance);
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
      const allocation = await repositories.allocations.findCurrentByPublicIdForUpdate(
        details.budgetAllocationPublicId.toString(),
      );
      if (allocation === null) throw new NotFoundError();
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        allocation.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertEligibleAllocation({
        allocation,
        office,
        entryDate: details.entryDate,
        fiscalPeriodPolicy: this.dependencies.fiscalPeriodPolicy,
      });
      asFuelBusinessRule(() => issuance.updateDraft(details, at));
      await repositories.issuances.updateDraft(issuance);
      await repositories.auditEvents.append(
        buildFuelIssuanceAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'updated',
          entityPublicId: issuance.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          before,
          after: fuelIssuanceAuditSnapshot(issuance),
        }),
      );
      return toFuelIssuanceDto({
        issuance,
        driver: fuelDriverDto(driver),
        vehicle: fuelVehicleDto(vehicle),
        allocation: fuelAllocationDto(allocation, office),
      });
    });
  }
}
