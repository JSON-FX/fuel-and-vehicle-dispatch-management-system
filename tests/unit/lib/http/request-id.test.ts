import { describe, expect, it, vi } from 'vitest';

import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { resolveRequestId } from '@/lib/http/request-id';

const generatedUuid = '019c043f-422c-7141-8a03-a9d9bda3544a';
const validUuidV4 = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

function generator(): PublicIdGenerator {
  return { generate: vi.fn(() => PublicId.from(generatedUuid)) };
}

describe('resolveRequestId', () => {
  it('preserves a valid incoming UUID', () => {
    expect(resolveRequestId(validUuidV4, generator())).toBe(validUuidV4);
  });

  it.each([null, '', 'not-a-uuid', 'x'.repeat(129)])(
    'generates a UUID version 7 for invalid input %s',
    (incoming) => {
      expect(resolveRequestId(incoming, generator())).toBe(generatedUuid);
    },
  );
});
