import type { AuditSearchQuery } from '@/application/audit/dto/audit-event-dtos';
import { ValidationError } from '@/application/shared/errors/application-error';
import { AuditAction } from '@/domain/audit/value-objects/audit-action';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const UTC_MILLISECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ENTITY_TYPE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function timestamp(value: string | null): string | null {
  if (value === null) return null;
  if (
    !UTC_MILLISECOND_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new ValidationError();
  }
  return value;
}

function publicId(value: string | null): string | null {
  if (value === null) return null;
  try {
    return PublicId.from(value).toString();
  } catch (error) {
    if (error instanceof DomainError) throw new ValidationError();
    throw error;
  }
}

export function validateAuditSearchQuery(query: AuditSearchQuery): AuditSearchQuery {
  if (!Number.isSafeInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new ValidationError();
  }
  const from = timestamp(query.from);
  const to = timestamp(query.to);
  if (from !== null && to !== null && from > to) throw new ValidationError();

  let action: string | null = null;
  try {
    action = query.action === null ? null : AuditAction.from(query.action).toString();
  } catch (error) {
    if (error instanceof DomainError) throw new ValidationError();
    throw error;
  }
  const entityType = query.entityType?.trim().toLowerCase() ?? null;
  if (entityType !== null && (entityType.length > 64 || !ENTITY_TYPE_PATTERN.test(entityType))) {
    throw new ValidationError();
  }
  const requestId = query.requestId?.trim() ?? null;
  if (
    requestId !== null &&
    (requestId.length < 1 || requestId.length > 128 || CONTROL_CHARACTER_PATTERN.test(requestId))
  ) {
    throw new ValidationError();
  }
  const cursor = query.cursor?.trim() ?? null;
  if (cursor !== null && (cursor.length < 1 || cursor.length > 2_048)) {
    throw new ValidationError();
  }

  return {
    from,
    to,
    action,
    entityType,
    entityPublicId: publicId(query.entityPublicId),
    actorPublicId: publicId(query.actorPublicId),
    requestId,
    cursor,
    pageSize: query.pageSize,
  };
}
