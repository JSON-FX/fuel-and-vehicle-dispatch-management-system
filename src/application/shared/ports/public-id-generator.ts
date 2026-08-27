import type { PublicId } from '@/domain/shared/value-objects/public-id';

export interface PublicIdGenerator {
  generate(): PublicId;
}
