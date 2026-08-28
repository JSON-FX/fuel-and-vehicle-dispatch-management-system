import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const UTC_MILLISECOND_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_UNSIGNED_64 = '18446744073709551615';

export interface AuditChainRecordProperties {
  readonly sequence: string;
  readonly sourcePosition: string;
  readonly sourceEventPublicId: string;
  readonly canonicalPayload: string;
  readonly previousHash: Uint8Array;
  readonly recordHash: Uint8Array;
  readonly chainedAt: string;
}

function validateUnsigned64(value: string, field: string): string {
  const isDecimal = /^[1-9]\d*$/.test(value);
  const inRange =
    value.length < MAX_UNSIGNED_64.length ||
    (value.length === MAX_UNSIGNED_64.length && value <= MAX_UNSIGNED_64);

  if (!isDecimal || !inRange) {
    throw new DomainError(
      'INVALID_AUDIT_SEQUENCE',
      `${field} must be a positive unsigned 64-bit decimal string.`,
    );
  }
  return value;
}

function validateHash(value: Uint8Array, field: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength !== 32) {
    throw new DomainError('INVALID_AUDIT_HASH', `${field} must contain exactly 32 bytes.`);
  }
  return value.slice();
}

function validateUtcTimestamp(value: string): string {
  if (
    !UTC_MILLISECOND_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new DomainError(
      'INVALID_AUDIT_TIMESTAMP',
      'Chain timestamps require a normalized UTC value with millisecond precision.',
    );
  }
  return value;
}

export class AuditChainRecord {
  readonly sequence: string;
  readonly sourcePosition: string;
  readonly sourceEventPublicId: string;
  readonly canonicalPayload: string;
  readonly chainedAt: string;
  readonly #previousHash: Uint8Array;
  readonly #recordHash: Uint8Array;

  private constructor(properties: AuditChainRecordProperties) {
    this.sequence = validateUnsigned64(properties.sequence, 'Audit sequence');
    this.sourcePosition = validateUnsigned64(properties.sourcePosition, 'Audit source position');
    this.sourceEventPublicId = PublicId.from(properties.sourceEventPublicId).toString();
    if (properties.canonicalPayload.length === 0) {
      throw new DomainError('EMPTY_AUDIT_PAYLOAD', 'Canonical audit payload text is required.');
    }
    this.canonicalPayload = properties.canonicalPayload;
    this.#previousHash = validateHash(properties.previousHash, 'Previous hash');
    this.#recordHash = validateHash(properties.recordHash, 'Record hash');
    this.chainedAt = validateUtcTimestamp(properties.chainedAt);
    Object.freeze(this);
  }

  static create(properties: AuditChainRecordProperties): AuditChainRecord {
    return new AuditChainRecord(properties);
  }

  get previousHash(): Uint8Array {
    return this.#previousHash.slice();
  }

  get recordHash(): Uint8Array {
    return this.#recordHash.slice();
  }
}
