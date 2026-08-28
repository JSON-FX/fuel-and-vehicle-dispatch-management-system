import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import type { FuelIssuance } from '@/domain/fuel/entities/fuel-issuance';

export type FuelIssuanceAuditAction = 'created' | 'updated' | 'posted' | 'voided';

export interface FuelIssuanceAuditEventDraft {
  readonly publicId: string;
  readonly action: FuelIssuanceAuditAction;
  readonly entityPublicId: string;
  readonly actorPublicId: string;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly occurredAt: Date;
  readonly reasonCode?: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: unknown;
}

export function buildFuelIssuanceAuditEvent(input: FuelIssuanceAuditEventDraft): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: `fuel_issuance.${input.action}`,
    entity: { type: 'fuel_issuance', publicId: input.entityPublicId },
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reasonCode: input.reasonCode ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  }).toPrimitives();
}

export function fuelIssuanceAuditSnapshot(
  issuance: FuelIssuance,
): Readonly<Record<string, string | boolean | null>> {
  return Object.freeze({
    risNumber: issuance.risNumber?.toString() ?? null,
    purchaseRequestNumber: issuance.purchaseRequestNumber.toString(),
    entryDate: issuance.entryDate.toString(),
    driverPublicId: issuance.driverPublicId.toString(),
    destination: issuance.destination,
    purpose: issuance.purpose,
    vehiclePublicId: issuance.vehiclePublicId.toString(),
    requestedLiters: issuance.requestedLiters?.toString() ?? null,
    isFullTank: issuance.isFullTank,
    issuedLiters: issuance.issuedLiters?.toString() ?? null,
    unitPrice: issuance.unitPrice.toString(),
    totalAmount: issuance.totalAmount?.toString() ?? null,
    budgetAllocationPublicId: issuance.budgetAllocationPublicId.toString(),
    fuelType: issuance.fuelType.toString(),
    status: issuance.status.toString(),
  });
}
