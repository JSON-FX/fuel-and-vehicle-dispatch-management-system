import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export function buildAuditAccessEvent(input: {
  readonly publicId: string;
  readonly occurredAt: Date;
  readonly actorPublicId: string;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly entityPublicId: string | null;
  readonly metadata: unknown;
}): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: 'audit.accessed',
    entity:
      input.entityPublicId === null
        ? null
        : { type: 'audit_event', publicId: input.entityPublicId },
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reasonCode: null,
    before: null,
    after: null,
    metadata: input.metadata,
  }).toPrimitives();
}
