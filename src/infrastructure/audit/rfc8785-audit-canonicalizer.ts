import canonicalize from 'canonicalize';

import type { AuditCanonicalizer } from '@/application/audit/ports/audit-canonicalizer';
import type { AuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';
import { toAuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';
import { DomainError } from '@/domain/shared/errors/domain-error';

function validateMaximumBytes(maximumBytes: number): void {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new DomainError(
      'INVALID_AUDIT_BYTE_LIMIT',
      'The canonical audit byte limit must be a positive safe integer.',
    );
  }
}

function encodeWithinLimit(canonicalText: string, maximumBytes: number): Uint8Array {
  const bytes = Buffer.from(canonicalText, 'utf8');
  if (bytes.byteLength > maximumBytes) {
    throw new DomainError(
      'AUDIT_PAYLOAD_TOO_LARGE',
      `The canonical audit payload exceeds the limit of ${maximumBytes} bytes.`,
    );
  }
  return new Uint8Array(bytes);
}

function serialize(value: AuditJsonValue): string {
  try {
    const result = canonicalize(value);
    if (result === undefined) {
      throw new Error('The canonicalizer returned no text.');
    }
    return result;
  } catch (cause) {
    throw new DomainError(
      'AUDIT_CANONICALIZATION_FAILED',
      cause instanceof Error
        ? `Audit canonicalization failed: ${cause.message}`
        : 'Audit canonicalization failed.',
    );
  }
}

export class Rfc8785AuditCanonicalizer implements AuditCanonicalizer {
  canonicalize(value: AuditJsonValue, maximumBytes: number): Uint8Array {
    validateMaximumBytes(maximumBytes);
    const validated = toAuditJsonValue(value);
    return encodeWithinLimit(serialize(validated), maximumBytes);
  }

  validateCanonicalText(canonicalText: string, maximumBytes: number): Uint8Array {
    validateMaximumBytes(maximumBytes);
    const originalBytes = encodeWithinLimit(canonicalText, maximumBytes);

    let parsed: unknown;
    try {
      parsed = JSON.parse(canonicalText) as unknown;
    } catch (cause) {
      throw new DomainError(
        'INVALID_STORED_AUDIT_JSON',
        cause instanceof Error
          ? `Stored audit JSON is invalid: ${cause.message}`
          : 'Stored audit JSON is invalid.',
      );
    }

    const validated = toAuditJsonValue(parsed);
    const expectedText = serialize(validated);
    if (expectedText !== canonicalText) {
      throw new DomainError(
        'NON_CANONICAL_AUDIT_PAYLOAD',
        'The stored audit payload does not contain exact RFC 8785 canonical text.',
      );
    }

    return originalBytes;
  }
}
