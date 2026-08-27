import { DomainError } from '@/domain/shared/errors/domain-error';
import { validate as validateUuid, version as uuidVersion } from 'uuid';

export class PublicId {
  private constructor(private readonly value: string) {}

  static from(value: string): PublicId {
    const canonicalValue = value.toLowerCase();
    if (!validateUuid(canonicalValue) || uuidVersion(canonicalValue) !== 7) {
      throw new DomainError(
        'INVALID_PUBLIC_ID',
        'A valid UUID version 7 public identifier is required.',
      );
    }

    return new PublicId(canonicalValue);
  }

  toString(): string {
    return this.value;
  }
}
