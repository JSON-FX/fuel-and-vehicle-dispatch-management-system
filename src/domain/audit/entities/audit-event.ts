import type { AuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';
import { toAuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';
import { AuditAction } from '@/domain/audit/value-objects/audit-action';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const UTC_MILLISECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const ENTITY_TYPE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export interface AuditEntityReference {
  readonly type: string;
  readonly publicId: string;
}

export interface AuditEventProperties {
  readonly publicId: string;
  readonly schemaVersion: number;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: AuditEntityReference | null;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly reasonCode: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly metadata: unknown;
}

export interface AuditEventPrimitives {
  readonly publicId: string;
  readonly schemaVersion: 1;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: AuditEntityReference | null;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly reasonCode: string | null;
  readonly before: AuditJsonValue | null;
  readonly after: AuditJsonValue | null;
  readonly metadata: AuditJsonValue | null;
}

function normalizeUtcTimestamp(value: string): string {
  if (!UTC_MILLISECOND_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DomainError(
      'INVALID_AUDIT_TIMESTAMP',
      'Audit timestamps require a valid UTC ISO 8601 value with millisecond precision.',
    );
  }

  const normalized = new Date(value).toISOString();
  if (normalized !== value) {
    throw new DomainError(
      'INVALID_AUDIT_TIMESTAMP',
      'Audit timestamps must already be normalized to UTC.',
    );
  }
  return normalized;
}

function isValidIpv4(value: string): boolean {
  const parts = value.split('.');
  return (
    parts.length === 4 &&
    parts.every((part) => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number.parseInt(part, 10) <= 255)
  );
}

function isValidIpv6(value: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(value) || value.includes(':::')) return false;
  if ((value.match(/::/g) ?? []).length > 1) return false;

  const rawParts = value.split(':');
  const last = rawParts.at(-1) ?? '';
  const hasIpv4Tail = last.includes('.');
  if (hasIpv4Tail && !isValidIpv4(last)) return false;

  const parts = hasIpv4Tail ? rawParts.slice(0, -1) : rawParts;
  const groups = parts.filter((part) => part.length > 0);
  if (!groups.every((part) => /^[0-9a-f]{1,4}$/i.test(part))) return false;

  const groupCount = groups.length + (hasIpv4Tail ? 2 : 0);
  return value.includes('::') ? groupCount < 8 : groupCount === 8;
}

function normalizeIpAddress(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (!isValidIpv4(normalized) && !isValidIpv6(normalized)) {
    throw new DomainError(
      'INVALID_AUDIT_IP_ADDRESS',
      'Audit IP addresses must be valid IPv4 or IPv6.',
    );
  }
  return normalized;
}

function validateBoundedText(
  value: string,
  maximumLength: number,
  code: string,
  description: string,
): string {
  if (value.length < 1 || value.length > maximumLength || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new DomainError(code, description);
  }
  return value;
}

function normalizeEntity(entity: AuditEntityReference | null): AuditEntityReference | null {
  if (entity === null) return null;

  const type = entity.type.trim().toLowerCase();
  if (type.length > 64 || !ENTITY_TYPE_PATTERN.test(type)) {
    throw new DomainError(
      'INVALID_AUDIT_ENTITY_TYPE',
      'Audit entity types require bounded lowercase segments.',
    );
  }

  return Object.freeze({
    type,
    publicId: PublicId.from(entity.publicId).toString(),
  });
}

function normalizeReasonCode(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 96 || !REASON_CODE_PATTERN.test(normalized)) {
    throw new DomainError(
      'INVALID_AUDIT_REASON_CODE',
      'Audit reason codes require bounded lowercase segments.',
    );
  }
  return normalized;
}

export class AuditEvent {
  private constructor(private readonly primitives: AuditEventPrimitives) {
    Object.freeze(this);
  }

  static create(properties: AuditEventProperties): AuditEvent {
    if (properties.schemaVersion !== 1) {
      throw new DomainError(
        'UNSUPPORTED_AUDIT_SCHEMA_VERSION',
        'Audit event schema version 1 is required.',
      );
    }

    const userAgent =
      properties.userAgent === null
        ? null
        : validateBoundedText(
            properties.userAgent,
            512,
            'INVALID_AUDIT_USER_AGENT',
            'Audit user agents must be nonempty, bounded, and free of control characters.',
          );

    const primitives: AuditEventPrimitives = Object.freeze({
      publicId: PublicId.from(properties.publicId).toString(),
      schemaVersion: 1,
      occurredAt: normalizeUtcTimestamp(properties.occurredAt),
      actorPublicId:
        properties.actorPublicId === null
          ? null
          : PublicId.from(properties.actorPublicId).toString(),
      action: AuditAction.from(properties.action).toString(),
      entity: normalizeEntity(properties.entity),
      requestId: validateBoundedText(
        properties.requestId,
        128,
        'INVALID_AUDIT_REQUEST_ID',
        'Audit request identifiers must be nonempty, bounded, and free of control characters.',
      ),
      ipAddress: normalizeIpAddress(properties.ipAddress),
      userAgent,
      reasonCode: normalizeReasonCode(properties.reasonCode),
      before: properties.before === null ? null : toAuditJsonValue(properties.before),
      after: properties.after === null ? null : toAuditJsonValue(properties.after),
      metadata: properties.metadata === null ? null : toAuditJsonValue(properties.metadata),
    });

    return new AuditEvent(primitives);
  }

  toPrimitives(): AuditEventPrimitives {
    return this.primitives;
  }
}
