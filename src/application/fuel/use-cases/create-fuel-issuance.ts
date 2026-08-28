import {
  toFuelIssuanceDto,
  type CreateFuelIssuanceCommand,
  type FuelIssuanceDto,
  type FuelRequestContext,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import {
  buildFuelIssuanceAuditEvent,
  fuelIssuanceAuditSnapshot,
} from '@/application/fuel/services/fuel-audit-events';
import {
  assertEligibleAllocation,
  assertOperationalDriver,
  assertOperationalVehicle,
  fuelAllocationDto,
  fuelDriverDto,
  fuelIssuanceDetails,
  fuelVehicleDto,
} from '@/application/fuel/services/fuel-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class CreateFuelIssuance {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly command: CreateFuelIssuanceCommand;
  }): Promise<FuelIssuanceDto> {
    this.dependencies.permissions.assertCanCreate(input.context.principal);
    const details = fuelIssuanceDetails(input.command);
    const at = this.dependencies.clock.now();
    const issuance = new FuelIssuance({
      publicId: this.dependencies.publicIds.generate(),
      ...details,
      createdByActorPublicId: PublicId.from(input.context.principal.userPublicId),
      createdAt: at,
      updatedAt: at,
    });

    return this.dependencies.transaction.execute(async (repositories) => {
      const driver = await repositories.drivers.findCurrentByPublicIdForUpdate(
        issuance.driverPublicId.toString(),
      );
      if (driver === null) throw new NotFoundError();
      assertOperationalDriver(driver);
      const vehicle = await repositories.vehicles.findCurrentByPublicIdForUpdate(
        issuance.vehiclePublicId.toString(),
      );
      if (vehicle === null) throw new NotFoundError();
      assertOperationalVehicle(vehicle);
      const allocation = await repositories.allocations.findCurrentByPublicIdForUpdate(
        issuance.budgetAllocationPublicId.toString(),
      );
      if (allocation === null) throw new NotFoundError();
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        allocation.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertEligibleAllocation({
        allocation,
        office,
        entryDate: issuance.entryDate,
        fiscalPeriodPolicy: this.dependencies.fiscalPeriodPolicy,
      });
      await repositories.issuances.insert(issuance);
      await repositories.auditEvents.append(
        buildFuelIssuanceAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'created',
          entityPublicId: issuance.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
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
