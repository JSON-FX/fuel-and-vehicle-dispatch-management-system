import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type {
  DispatchConflictOverrideWriteDto,
  DispatchScheduleSettingsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchRequestContext } from '@/application/dispatch/dto/dispatch-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export function buildDispatchConflictOverrideAuditEvent(input: {
  readonly publicId: string;
  readonly dispatchPublicId: string;
  readonly context: DispatchRequestContext;
  readonly at: Date;
  readonly fingerprint: string;
  readonly rows: readonly DispatchConflictOverrideWriteDto[];
}): AuditEventInput {
  const first = input.rows[0];
  if (first === undefined) throw new Error('Conflict override audit requires evidence rows.');

  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.at.toISOString(),
    actorPublicId: input.context.principal.userPublicId,
    action: 'vehicle_dispatch.conflict_override_acknowledged',
    entity: { type: 'vehicle_dispatch', publicId: input.dispatchPublicId },
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
    reasonCode: 'schedule_conflict_acknowledged',
    before: null,
    after: { acknowledged: true },
    metadata: {
      policy: first.policy,
      reason: first.reason,
      fingerprint: input.fingerprint,
      conflictCount: input.rows.length,
      conflicts: input.rows.map((row) => ({
        dispatchPublicId: row.conflictingDispatchPublicId,
        conflictType: row.conflictType,
      })),
    },
  }).toPrimitives();
}

export function buildDispatchScheduleSettingsAuditEvent(input: {
  readonly publicId: string;
  readonly context: DispatchRequestContext;
  readonly at: Date;
  readonly before: DispatchScheduleSettingsDto;
  readonly after: DispatchScheduleSettingsDto;
}): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.at.toISOString(),
    actorPublicId: input.context.principal.userPublicId,
    action: 'dispatch_schedule.policy.changed',
    entity: null,
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
    reasonCode: null,
    before: { policy: input.before.policy },
    after: { policy: input.after.policy },
    metadata: {
      previousPolicy: input.before.policy,
      nextPolicy: input.after.policy,
    },
  }).toPrimitives();
}
