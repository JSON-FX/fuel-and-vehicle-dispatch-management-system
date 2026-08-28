import type { AuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';

export interface AuditEntityReferenceDto {
  readonly type: string;
  readonly publicId: string;
}

export interface AuditEventInput {
  readonly publicId: string;
  readonly schemaVersion: 1;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: AuditEntityReferenceDto | null;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly reasonCode: string | null;
  readonly before: AuditJsonValue | null;
  readonly after: AuditJsonValue | null;
  readonly metadata: AuditJsonValue | null;
}

export interface AuditSearchQuery {
  readonly from: string | null;
  readonly to: string | null;
  readonly action: string | null;
  readonly entityType: string | null;
  readonly entityPublicId: string | null;
  readonly actorPublicId: string | null;
  readonly requestId: string | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface AuditEventSummaryDto {
  readonly publicId: string;
  readonly sequence: string;
  readonly occurredAt: string;
  readonly actorPublicId: string | null;
  readonly action: string;
  readonly entity: AuditEntityReferenceDto | null;
  readonly requestId: string;
}

export interface AuditSensitiveContextDto {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly before: AuditJsonValue | null;
  readonly after: AuditJsonValue | null;
  readonly metadata: AuditJsonValue | null;
}

export interface AuditEventDetailDto extends AuditEventSummaryDto {
  readonly sourcePosition: string;
  readonly schemaVersion: 1;
  readonly reasonCode: string | null;
  readonly previousHashHex: string;
  readonly recordHashHex: string;
  readonly chainedAt: string;
  readonly sensitive: AuditSensitiveContextDto | null;
}

export interface AuditEventPageDto {
  readonly items: readonly AuditEventSummaryDto[];
  readonly previousCursor: string | null;
  readonly nextCursor: string | null;
}

export type AuditVerificationStatus = 'PASS' | 'FAIL';

export type AuditVerificationMismatchType =
  | 'MISSING_PRIMARY'
  | 'MISSING_SINK'
  | 'EXTRA_SINK'
  | 'DUPLICATE_SINK'
  | 'CHANGED_PAYLOAD'
  | 'PREVIOUS_HASH_MISMATCH'
  | 'RECORD_HASH_MISMATCH'
  | 'REORDERED_SEQUENCE'
  | 'EVENT_ID_MISMATCH'
  | 'CAPTURED_HEAD_MISMATCH';

export interface AuditVerificationStatusDto {
  readonly publicId: string;
  readonly status: AuditVerificationStatus;
  readonly highWaterSequence: string;
  readonly verifiedCount: string;
  readonly firstMismatchSequence: string | null;
  readonly firstMismatchType: AuditVerificationMismatchType | null;
  readonly summary: string;
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface AuditOutboxRecordDto {
  readonly sourcePosition: string;
  readonly eventPublicId: string;
  readonly canonicalPayload: string;
  readonly capturedAt: string;
}

export interface AuditChainHeadDto {
  readonly sequence: string;
  readonly sourcePosition: string;
  readonly recordHash: Uint8Array;
}

export interface AuditPendingSinkDeliveryDto {
  readonly sequence: string;
  readonly eventPublicId: string;
  readonly canonicalPayload: string;
  readonly previousHash: Uint8Array;
  readonly recordHash: Uint8Array;
  readonly attemptCount: number;
}

export interface AuditSinkRecordDto {
  readonly deliveryFingerprint: Uint8Array;
  readonly sequence: string;
  readonly eventPublicId: string;
  readonly canonicalPayload: string;
  readonly previousHash: Uint8Array;
  readonly recordHash: Uint8Array;
  readonly deliveredAt: string;
}

export interface AuditVerificationHighWaterMarkDto {
  readonly sequence: string;
  readonly recordHash: Uint8Array;
}

export interface AuditVerificationChainRecordDto {
  readonly sequence: string;
  readonly sourcePosition: string;
  readonly eventPublicId: string;
  readonly canonicalPayload: string;
  readonly previousHash: Uint8Array;
  readonly recordHash: Uint8Array;
}

export interface AuditSinkVerificationCursorDto {
  readonly sequence: string;
  readonly deliveryFingerprint: Uint8Array;
}

export type CompletedAuditVerificationRunDto = AuditVerificationStatusDto;
