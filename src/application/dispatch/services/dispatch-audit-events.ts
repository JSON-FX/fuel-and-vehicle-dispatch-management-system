import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { VehicleDispatch } from '@/domain/dispatch/entities/vehicle-dispatch';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export type DispatchAuditAction = 'created' | 'updated' | 'dispatched' | 'completed' | 'cancelled';

export interface DispatchAuditEventDraft {
  readonly publicId: string;
  readonly action: DispatchAuditAction;
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

export function buildDispatchAuditEvent(input: DispatchAuditEventDraft): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: `vehicle_dispatch.${input.action}`,
    entity: { type: 'vehicle_dispatch', publicId: input.entityPublicId },
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reasonCode: input.reasonCode ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  }).toPrimitives();
}

export function dispatchAuditSnapshot(
  dispatch: VehicleDispatch,
): Readonly<Record<string, string | number | null>> {
  return Object.freeze({
    entryDate: dispatch.entryDate.toString(),
    travelDate: dispatch.travelDate.toString(),
    driverPublicId: dispatch.driverPublicId.toString(),
    vehiclePublicId: dispatch.vehiclePublicId.toString(),
    requestingOfficePublicId: dispatch.requestingOfficePublicId.toString(),
    destination: dispatch.destination,
    purpose: dispatch.purpose,
    odoBefore: dispatch.odoBefore.toString(),
    odoAfter: dispatch.odoAfter?.toString() ?? null,
    distance: dispatch.distance,
    passengerCount: dispatch.passengerCount.toNumber(),
    status: dispatch.status.toString(),
    dispatchedAt: dispatch.dispatchedAt?.toISOString() ?? null,
    completedAt: dispatch.completedAt?.toISOString() ?? null,
    cancelledAt: dispatch.cancelledAt?.toISOString() ?? null,
    cancelledByActorPublicId: dispatch.cancelledByActorPublicId?.toString() ?? null,
    cancellationReason: dispatch.cancellationReason,
  });
}
