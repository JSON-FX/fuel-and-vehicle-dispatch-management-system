import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { MasterDataResource } from '@/application/master-data/dto/master-data-list-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export type MasterDataAuditAction =
  'created' | 'updated' | 'status_changed' | 'deleted' | 'restored';

export interface MasterDataAuditEventDraft {
  readonly publicId: string;
  readonly resource: MasterDataResource;
  readonly action: MasterDataAuditAction;
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

export function buildMasterDataAuditEvent(input: MasterDataAuditEventDraft): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: `${input.resource}.${input.action}`,
    entity: { type: input.resource, publicId: input.entityPublicId },
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reasonCode: input.reasonCode ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
  }).toPrimitives();
}

export function driverAuditSnapshot(input: {
  readonly name: string;
  readonly status: string;
  readonly contactNumber: string | null;
}): Readonly<Record<string, string | boolean>> {
  return Object.freeze({
    name: input.name,
    status: input.status,
    hasContactNumber: input.contactNumber !== null,
  });
}
