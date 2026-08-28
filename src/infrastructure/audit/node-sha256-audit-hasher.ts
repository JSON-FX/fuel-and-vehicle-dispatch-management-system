import { createHash } from 'node:crypto';

import type {
  AuditDeliveryFingerprintInput,
  AuditHasher,
  AuditRecordHashInput,
} from '@/application/audit/ports/audit-hasher';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const RECORD_DOMAIN = Buffer.from('FVDMS-AUDIT', 'ascii');
const DELIVERY_DOMAIN = Buffer.from('FVDMS-AUDIT-SINK', 'ascii');
const MAX_UNSIGNED_64 = '18446744073709551615';
const MAX_UNSIGNED_32 = 0xffff_ffff;

function validateSequence(value: string): string {
  const isDecimal = /^[1-9]\d*$/.test(value);
  const inRange =
    value.length < MAX_UNSIGNED_64.length ||
    (value.length === MAX_UNSIGNED_64.length && value <= MAX_UNSIGNED_64);

  if (!isDecimal || !inRange) {
    throw new DomainError(
      'INVALID_AUDIT_SEQUENCE',
      'Audit sequence must be a positive unsigned 64-bit decimal string.',
    );
  }
  return value;
}

function validateHash(value: Uint8Array, field: string): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new DomainError('INVALID_AUDIT_HASH', `${field} must contain exactly 32 bytes.`);
  }
  return Buffer.from(value);
}

function validatePayload(value: Uint8Array): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength > MAX_UNSIGNED_32) {
    throw new DomainError(
      'INVALID_AUDIT_PAYLOAD_BYTES',
      'Canonical audit payload must fit an unsigned 32-bit byte length.',
    );
  }
  return Buffer.from(value);
}

function unsigned64(value: string): Buffer {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(validateSequence(value)));
  return bytes;
}

function lengthPrefix(byteLength: number): Buffer {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32BE(byteLength);
  return bytes;
}

export function buildAuditRecordPreimage(input: AuditRecordHashInput): Uint8Array {
  if (input.formatVersion !== 1) {
    throw new DomainError(
      'UNSUPPORTED_AUDIT_HASH_VERSION',
      'Audit record hash format version 1 is required.',
    );
  }

  const payload = validatePayload(input.canonicalPayload);
  return new Uint8Array(
    Buffer.concat([
      RECORD_DOMAIN,
      Buffer.from([input.formatVersion]),
      unsigned64(input.sequence),
      validateHash(input.previousHash, 'Previous hash'),
      lengthPrefix(payload.byteLength),
      payload,
    ]),
  );
}

function buildDeliveryPreimage(input: AuditDeliveryFingerprintInput): Uint8Array {
  const eventPublicId = Buffer.from(PublicId.from(input.eventPublicId).toString(), 'ascii');
  const payload = validatePayload(input.canonicalPayload);

  return new Uint8Array(
    Buffer.concat([
      DELIVERY_DOMAIN,
      unsigned64(input.sequence),
      eventPublicId,
      lengthPrefix(payload.byteLength),
      payload,
      validateHash(input.previousHash, 'Previous hash'),
      validateHash(input.recordHash, 'Record hash'),
    ]),
  );
}

export class NodeSha256AuditHasher implements AuditHasher {
  hashRecord(input: AuditRecordHashInput): Uint8Array {
    return new Uint8Array(createHash('sha256').update(buildAuditRecordPreimage(input)).digest());
  }

  hashDelivery(input: AuditDeliveryFingerprintInput): Uint8Array {
    return new Uint8Array(createHash('sha256').update(buildDeliveryPreimage(input)).digest());
  }
}
