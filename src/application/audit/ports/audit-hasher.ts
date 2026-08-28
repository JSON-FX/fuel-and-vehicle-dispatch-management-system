export interface AuditRecordHashInput {
  readonly formatVersion: 1;
  readonly sequence: string;
  readonly previousHash: Uint8Array;
  readonly canonicalPayload: Uint8Array;
}

export interface AuditDeliveryFingerprintInput {
  readonly sequence: string;
  readonly eventPublicId: string;
  readonly canonicalPayload: Uint8Array;
  readonly previousHash: Uint8Array;
  readonly recordHash: Uint8Array;
}

export interface AuditHasher {
  hashRecord(input: AuditRecordHashInput): Uint8Array;
  hashDelivery(input: AuditDeliveryFingerprintInput): Uint8Array;
}
