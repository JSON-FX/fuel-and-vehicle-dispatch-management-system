import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export interface AuthenticationAuditEventDraft {
  readonly publicId: string;
  readonly action: string;
  readonly actorPublicId: string | null;
  readonly targetPublicId: string | null;
  readonly targetType?: string;
  readonly requestId: string;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
  readonly reasonCode: string | null;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata: unknown;
  readonly occurredAt: Date;
}

function rolePublicId(metadata: unknown): string | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).rolePublicId;
  return typeof value === 'string' ? value : null;
}

function entityFor(input: AuthenticationAuditEventDraft): AuditEventInput['entity'] {
  if (input.targetPublicId !== null) {
    return { type: input.targetType ?? 'user', publicId: input.targetPublicId };
  }

  const roleId = input.action.startsWith('auth.role.') ? rolePublicId(input.metadata) : null;
  return roleId === null ? null : { type: 'role', publicId: roleId };
}

export function buildAuthenticationAuditEvent(
  input: AuthenticationAuditEventDraft,
): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.actorPublicId,
    action: input.action,
    entity: entityFor(input),
    requestId: input.requestId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    reasonCode: input.reasonCode,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata,
  }).toPrimitives();
}
