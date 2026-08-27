import { describe, expect, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { binaryToPublicId, publicIdToBinary } from '@/infrastructure/database/uuid-binary';

const uuidV7 = '019c043f-422c-7141-8a03-a9d9bda3544a';

describe('UUID binary codec', () => {
  it('round trips a UUID version 7 through exactly 16 bytes', () => {
    const publicId = PublicId.from(uuidV7);
    const binary = publicIdToBinary(publicId);

    expect(binary).toHaveLength(16);
    expect(binaryToPublicId(binary).toString()).toBe(uuidV7);
  });

  it('rejects binary values that are not exactly 16 bytes', () => {
    expect(() => binaryToPublicId(Buffer.alloc(15))).toThrow();
    expect(() => binaryToPublicId(Buffer.alloc(17))).toThrow();
  });

  it('rejects a 16-byte value that does not encode a UUID version 7', () => {
    expect(() => binaryToPublicId(Buffer.alloc(16))).toThrow();
  });
});
