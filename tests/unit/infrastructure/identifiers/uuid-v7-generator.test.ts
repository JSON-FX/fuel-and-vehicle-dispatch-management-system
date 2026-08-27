import { describe, expect, it } from 'vitest';
import { validate, version } from 'uuid';

import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

describe('UuidV7Generator', () => {
  it('generates a valid UUID version 7 PublicId', () => {
    const value = new UuidV7Generator().generate().toString();

    expect(validate(value)).toBe(true);
    expect(version(value)).toBe(7);
  });
});
