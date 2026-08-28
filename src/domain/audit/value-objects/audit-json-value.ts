import { DomainError } from '@/domain/shared/errors/domain-error';

export type AuditJsonPrimitive = null | boolean | string | number;
export type AuditJsonArray = readonly AuditJsonValue[];
export type AuditJsonObject = { readonly [key: string]: AuditJsonValue };
export type AuditJsonValue = AuditJsonPrimitive | AuditJsonArray | AuditJsonObject;

export interface AuditJsonLimits {
  readonly maxDepth: number;
  readonly maxArrayLength: number;
  readonly maxObjectKeys: number;
  readonly maxStringLength: number;
  readonly maxTotalNodes: number;
}

export const AUDIT_JSON_LIMITS: AuditJsonLimits = Object.freeze({
  maxDepth: 10,
  maxArrayLength: 100,
  maxObjectKeys: 100,
  maxStringLength: 8_192,
  maxTotalNodes: 1_000,
});

const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'csrftoken',
  'encryptedsecret',
  'manualsecret',
  'password',
  'passwordhash',
  'resettoken',
  'sessiontoken',
  'totpsecret',
]);

const error = (code: string, message: string): never => {
  throw new DomainError(code, message);
};

function validateLimits(limits: AuditJsonLimits): void {
  for (const value of Object.values(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      error('INVALID_AUDIT_JSON_LIMIT', 'Audit JSON limits must be positive safe integers.');
    }
  }
}

function normalizedKey(key: string): string {
  return key.replaceAll(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export function toAuditJsonValue(
  input: unknown,
  overrides: Partial<AuditJsonLimits> = {},
): AuditJsonValue {
  const limits = { ...AUDIT_JSON_LIMITS, ...overrides };
  validateLimits(limits);

  const ancestors = new Set<object>();
  let totalNodes = 0;

  const visit = (value: unknown, depth: number): AuditJsonValue => {
    totalNodes += 1;
    if (totalNodes > limits.maxTotalNodes) {
      error('AUDIT_JSON_TOO_MANY_VALUES', 'Audit JSON contains too many values.');
    }

    if (depth > limits.maxDepth) {
      error('AUDIT_JSON_TOO_DEEP', 'Audit JSON exceeds the maximum nesting depth.');
    }

    if (value === null || typeof value === 'boolean') return value;

    if (typeof value === 'string') {
      if (value.length > limits.maxStringLength) {
        error('AUDIT_JSON_STRING_TOO_LONG', 'An audit JSON string exceeds the maximum length.');
      }
      return value;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value) || !Number.isSafeInteger(value) || Object.is(value, -0)) {
        error(
          'INVALID_AUDIT_JSON_NUMBER',
          'Audit JSON numbers must be finite safe integers and cannot be negative zero.',
        );
      }
      return value;
    }

    if (typeof value !== 'object' || value === null) {
      return error('UNSUPPORTED_AUDIT_JSON_VALUE', 'Audit JSON contains an unsupported value.');
    }

    if (value instanceof Date) {
      error('RAW_DATE_IN_AUDIT_JSON', 'Audit JSON timestamps must be normalized strings.');
    }

    if (ancestors.has(value)) {
      error('CYCLIC_AUDIT_JSON', 'Audit JSON cannot contain cyclic values.');
    }

    ancestors.add(value);

    try {
      if (Array.isArray(value)) {
        if (value.length > limits.maxArrayLength) {
          error('AUDIT_JSON_ARRAY_TOO_LONG', 'An audit JSON array exceeds the maximum length.');
        }

        for (let index = 0; index < value.length; index += 1) {
          if (!Object.hasOwn(value, index)) {
            error('SPARSE_AUDIT_JSON_ARRAY', 'Audit JSON cannot contain sparse arrays.');
          }
        }

        return Object.freeze(value.map((item) => visit(item, depth + 1)));
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        error('UNSUPPORTED_AUDIT_JSON_OBJECT', 'Audit JSON accepts only plain objects.');
      }

      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > limits.maxObjectKeys) {
        error('AUDIT_JSON_OBJECT_TOO_LARGE', 'An audit JSON object has too many keys.');
      }

      const copy: Record<string, AuditJsonValue> = {};
      for (const [key, child] of entries) {
        if (PROTOTYPE_KEYS.has(key)) {
          error('UNSAFE_AUDIT_JSON_KEY', 'Audit JSON contains an unsafe prototype key.');
        }
        if (SENSITIVE_KEYS.has(normalizedKey(key))) {
          error('SENSITIVE_AUDIT_JSON_KEY', 'Audit JSON contains a sensitive key.');
        }

        copy[key] = visit(child, depth + 1);
      }

      return Object.freeze(copy);
    } finally {
      ancestors.delete(value);
    }
  };

  return visit(input, 0);
}
