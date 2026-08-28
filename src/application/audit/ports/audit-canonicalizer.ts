import type { AuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';

export interface AuditCanonicalizer {
  canonicalize(value: AuditJsonValue, maximumBytes: number): Uint8Array;
  validateCanonicalText(canonicalText: string, maximumBytes: number): Uint8Array;
}
