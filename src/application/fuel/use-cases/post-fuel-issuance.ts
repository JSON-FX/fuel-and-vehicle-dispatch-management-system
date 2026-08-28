import {
  toFuelIssuanceDto,
  type FuelIssuanceDto,
  type FuelRequestContext,
  type PostFuelIssuanceCommand,
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
  fuelVehicleDto,
} from '@/application/fuel/services/fuel-use-case-support';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import { DomainError } from '@/domain/shared/errors/domain-error';

export class PostFuelIssuance {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly publicId: string;
    readonly command: PostFuelIssuanceCommand;
  }): Promise<FuelIssuanceDto> {
    this.dependencies.permissions.assertCanPost(input.context.principal);
    const issuedLiters = parseIssuedLiters(input.command.issuedLiters);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const issuance = await repositories.issuances.findByPublicIdForUpdate(input.publicId);
      if (issuance === null) throw new NotFoundError();
      const before = fuelIssuanceAuditSnapshot(issuance);
      const sequence = await repositories.sequences.next({
        year: issuance.entryDate.year,
        month: issuance.entryDate.month,
        at,
      });
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
      const risNumber = RisNumber.issue(issuance.entryDate, sequence);
      asFuelBusinessRule(() =>
        issuance.post({
          risNumber,
          issuedLiters,
          totalAmount: FuelTotal.calculate(issuedLiters, issuance.unitPrice),
          at,
        }),
      );
      await repositories.issuances.markPosted(issuance);
      await repositories.ledger.append(
        FuelLedgerEntry.issuance({
          publicId: this.dependencies.publicIds.generate(),
          fuelIssuancePublicId: issuance.publicId,
          fuelType: issuance.fuelType,
          quantity: issuedLiters,
          effectiveDate: issuance.entryDate,
          reference: risNumber.toString(),
          createdAt: at,
        }),
      );
      await repositories.auditEvents.append(
        buildFuelIssuanceAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'posted',
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

function parseIssuedLiters(value: string): FuelQuantity {
  try {
    return FuelQuantity.from(value);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ValidationError([{ field: 'issuedLiters', reason: error.message }]);
    }
    throw error;
  }
}
