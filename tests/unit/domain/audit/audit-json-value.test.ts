import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { AUDIT_JSON_LIMITS, toAuditJsonValue } from '@/domain/audit/value-objects/audit-json-value';

describe('audit-safe JSON', () => {
  it('accepts and freezes every supported recursive value', () => {
    const source = {
      approved: true,
      count: 12,
      note: 'Fuel request',
      optional: null,
      values: ['12.50', false, { timestamp: '2026-08-28T00:00:00.000Z' }],
    };

    const value = toAuditJsonValue(source);

    expect(value).toEqual(source);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen((value as { values: readonly unknown[] }).values)).toBe(true);
  });

  it.each([
    undefined,
    () => undefined,
    Symbol('unsupported'),
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    -0,
    1.25,
    new Date('2026-08-28T00:00:00.000Z'),
  ])('rejects an unsupported value %#', (value) => {
    expect(() => toAuditJsonValue(value)).toThrow(DomainError);
  });

  it('rejects sparse arrays and cyclic values', () => {
    const sparse = new Array<unknown>(2);
    sparse[1] = 'present';

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => toAuditJsonValue(sparse)).toThrowError(/sparse/i);
    expect(() => toAuditJsonValue(cyclic)).toThrowError(/cyclic/i);
  });

  it.each(['__proto__', 'prototype', 'constructor'])('rejects %s at any object level', (key) => {
    const nested = { allowed: Object.fromEntries([[key, 'unsafe']]) };

    expect(() => toAuditJsonValue(nested)).toThrowError(/key/i);
  });

  it.each([
    'password',
    'passwordHash',
    'session_token',
    'csrfToken',
    'totp_secret',
    'authorization',
    'cookie',
  ])('rejects the sensitive key %s', (key) => {
    expect(() => toAuditJsonValue(Object.fromEntries([[key, 'secret']]))).toThrowError(
      /sensitive/i,
    );
  });

  it('enforces depth, container, string, and total-node limits', () => {
    let tooDeep: unknown = 'leaf';
    for (let index = 0; index <= AUDIT_JSON_LIMITS.maxDepth; index += 1) {
      tooDeep = { child: tooDeep };
    }

    const tooManyArrayItems = Array.from(
      { length: AUDIT_JSON_LIMITS.maxArrayLength + 1 },
      () => null,
    );
    const tooManyObjectKeys = Object.fromEntries(
      Array.from({ length: AUDIT_JSON_LIMITS.maxObjectKeys + 1 }, (_, index) => [
        `key${index}`,
        null,
      ]),
    );
    const tooLongString = 'x'.repeat(AUDIT_JSON_LIMITS.maxStringLength + 1);
    const tooManyNodes = Array.from({ length: AUDIT_JSON_LIMITS.maxTotalNodes }, () => [null]);

    expect(() => toAuditJsonValue(tooDeep)).toThrowError(/depth/i);
    expect(() => toAuditJsonValue(tooManyArrayItems)).toThrowError(/array/i);
    expect(() => toAuditJsonValue(tooManyObjectKeys)).toThrowError(/object/i);
    expect(() => toAuditJsonValue(tooLongString)).toThrowError(/string/i);
    expect(() =>
      toAuditJsonValue(tooManyNodes, {
        maxArrayLength: AUDIT_JSON_LIMITS.maxTotalNodes,
      }),
    ).toThrowError(/values/i);
  });
});
