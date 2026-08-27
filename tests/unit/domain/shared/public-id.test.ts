import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const UUID_V7 = '01a043f4-22c5-7141-8a03-a9d9bda3544a';

describe('PublicId', () => {
  it('accepts an RFC 9562 UUID version 7 value', () => {
    expect(PublicId.from(UUID_V7).toString()).toBe(UUID_V7);
  });

  it('normalizes a valid UUID version 7 value to lowercase', () => {
    expect(PublicId.from(UUID_V7.toUpperCase()).toString()).toBe(UUID_V7);
  });

  it.each([
    '550e8400-e29b-41d4-a716-446655440000',
    'not-a-uuid',
    '',
    '01a043f4-22c5-7141-ca03-a9d9bda3544a',
  ])('rejects a non-version-7 public identifier %j', (value) => {
    expect(() => PublicId.from(value)).toThrow(DomainError);
  });
});
