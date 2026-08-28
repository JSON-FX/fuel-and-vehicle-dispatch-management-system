import {
  toFuelIssuanceDto,
  type FuelIssuanceDto,
  type FuelRequestContext,
  type VoidFuelIssuanceCommand,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelRepositories } from '@/application/fuel/ports/fuel-transaction';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import {
  buildFuelIssuanceAuditEvent,
  fuelIssuanceAuditSnapshot,
} from '@/application/fuel/services/fuel-audit-events';
import {
  asFuelBusinessRule,
  fuelAllocationDto,
  fuelDriverDto,
  fuelVehicleDto,
} from '@/application/fuel/services/fuel-use-case-support';
import { BusinessRuleError, NotFoundError } from '@/application/shared/errors/application-error';
import { FuelLedgerEntry } from '@/domain/fuel/entities/fuel-ledger-entry';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class VoidFuelIssuance {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly publicId: string;
    readonly command: VoidFuelIssuanceCommand;
  }): Promise<FuelIssuanceDto> {
    this.dependencies.permissions.assertCanVoid(input.context.principal);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const issuance = await repositories.issuances.findByPublicIdForUpdate(input.publicId);
      if (issuance === null) throw new NotFoundError();
      const before = fuelIssuanceAuditSnapshot(issuance);
      asFuelBusinessRule(() =>
        issuance.void({
          at,
          actorPublicId: PublicId.from(input.context.principal.userPublicId),
          reason: input.command.reason,
        }),
      );
      if (issuance.issuedLiters === null || issuance.risNumber === null) {
        throw new BusinessRuleError('The posted fuel issuance evidence is incomplete.');
      }
      await repositories.issuances.markVoided(issuance);
      await repositories.ledger.append(
        FuelLedgerEntry.voidCompensation({
          publicId: this.dependencies.publicIds.generate(),
          fuelIssuancePublicId: issuance.publicId,
          fuelType: issuance.fuelType,
          quantity: issuance.issuedLiters,
          effectiveDate: issuance.entryDate,
          reference: issuance.risNumber.toString(),
          createdAt: at,
        }),
      );
      await repositories.auditEvents.append(
        buildFuelIssuanceAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'voided',
          entityPublicId: issuance.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'OPERATOR_VOID',
          before,
          after: fuelIssuanceAuditSnapshot(issuance),
          metadata: { reason: issuance.voidReason },
        }),
      );
      const record = await historicalRecord(repositories, issuance);
      return toFuelIssuanceDto(record);
    });
  }
}

async function historicalRecord(
  repositories: FuelRepositories,
  issuance: Parameters<typeof fuelIssuanceAuditSnapshot>[0],
) {
  const driver = await repositories.drivers.findIncludingDeletedByPublicId(
    issuance.driverPublicId.toString(),
  );
  const vehicle = await repositories.vehicles.findIncludingDeletedByPublicId(
    issuance.vehiclePublicId.toString(),
  );
  const allocation = await repositories.allocations.findIncludingDeletedByPublicId(
    issuance.budgetAllocationPublicId.toString(),
  );
  if (driver === null || vehicle === null || allocation === null) throw new NotFoundError();
  const office = await repositories.offices.findIncludingDeletedByPublicId(
    allocation.officePublicId.toString(),
  );
  if (office === null) throw new NotFoundError();
  return {
    issuance,
    driver: fuelDriverDto(driver),
    vehicle: fuelVehicleDto(vehicle),
    allocation: fuelAllocationDto(allocation, office),
  };
}
