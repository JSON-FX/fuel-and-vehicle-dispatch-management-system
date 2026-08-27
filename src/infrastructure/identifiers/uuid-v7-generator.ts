import { v7 as uuidV7 } from 'uuid';

import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class UuidV7Generator implements PublicIdGenerator {
  generate(): PublicId {
    return PublicId.from(uuidV7());
  }
}
