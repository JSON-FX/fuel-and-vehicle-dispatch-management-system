import { parse as parseUuid, stringify as stringifyUuid } from 'uuid';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const uuidByteLength = 16;

export function publicIdToBinary(publicId: PublicId): Buffer {
  return Buffer.from(parseUuid(publicId.toString()));
}

export function binaryToPublicId(value: Uint8Array): PublicId {
  if (value.byteLength !== uuidByteLength) {
    throw new Error(`A UUID binary value must contain exactly ${uuidByteLength} bytes.`);
  }

  return PublicId.from(stringifyUuid(value));
}
