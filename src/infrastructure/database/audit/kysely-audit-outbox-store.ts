import { isIP } from 'node:net';

import type { Kysely } from 'kysely';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import { toAuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';
import { PublicId as AuditEventPublicId } from '@/domain/shared/value-objects/public-id';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import type { Database } from '@/infrastructure/database/types';
import { publicIdToBinary } from '@/infrastructure/database/uuid-binary';

export interface AuditOutboxStoreOptions {
  readonly primarySchema: string;
  readonly maximumCanonicalPayloadBytes: number;
}

function ipv4Bytes(value: string): Buffer {
  return Buffer.from(value.split('.').map((part) => Number.parseInt(part, 10)));
}

function ipv6Bytes(value: string): Buffer {
  let normalized = value;
  const lastColon = normalized.lastIndexOf(':');
  const tail = normalized.slice(lastColon + 1);
  if (tail.includes('.')) {
    const ipv4 = ipv4Bytes(tail);
    normalized = `${normalized.slice(0, lastColon)}:${ipv4.readUInt16BE(0).toString(16)}:${ipv4
      .readUInt16BE(2)
      .toString(16)}`;
  }

  const [leftText, rightText] = normalized.split('::');
  const left = leftText === '' ? [] : leftText!.split(':');
  const right = rightText === undefined || rightText === '' ? [] : rightText.split(':');
  const zeroCount = 8 - left.length - right.length;
  const groups =
    rightText === undefined ? left : [...left, ...Array(zeroCount).fill('0'), ...right];
  const bytes = Buffer.alloc(16);
  groups.forEach((group, index) => bytes.writeUInt16BE(Number.parseInt(group, 16), index * 2));
  return bytes;
}

export function auditIpAddressToBinary(value: string | null): Buffer | null {
  if (value === null) return null;
  const version = isIP(value);
  if (version === 4) return ipv4Bytes(value);
  if (version === 6) return ipv6Bytes(value.toLowerCase());
  throw new Error('Audit IP addresses must be valid IPv4 or IPv6 values.');
}

export class KyselyAuditOutboxStore implements AuditEventPort {
  private readonly canonicalizer = new Rfc8785AuditCanonicalizer();

  constructor(
    private readonly database: Kysely<Database>,
    private readonly options: AuditOutboxStoreOptions,
  ) {}

  async append(input: AuditEventInput): Promise<void> {
    const event = AuditEvent.create(input).toPrimitives();
    const canonicalPayload = Buffer.from(
      this.canonicalizer.canonicalize(
        toAuditJsonValue(event),
        this.options.maximumCanonicalPayloadBytes,
      ),
    ).toString('utf8');

    await this.database
      .withSchema(this.options.primarySchema)
      .insertInto('audit_outbox')
      .values({
        legacy_security_event_id: null,
        event_public_id: publicIdToBinary(AuditEventPublicId.from(event.publicId)),
        schema_version: event.schemaVersion,
        occurred_at: new Date(event.occurredAt),
        actor_public_id:
          event.actorPublicId === null
            ? null
            : publicIdToBinary(AuditEventPublicId.from(event.actorPublicId)),
        action: event.action,
        entity_type: event.entity?.type ?? null,
        entity_public_id:
          event.entity === null
            ? null
            : publicIdToBinary(AuditEventPublicId.from(event.entity.publicId)),
        request_id: event.requestId,
        reason_code: event.reasonCode,
        ip_address: auditIpAddressToBinary(event.ipAddress),
        user_agent: event.userAgent,
        canonical_payload: canonicalPayload,
        captured_at: new Date(),
      })
      .execute();
  }
}
