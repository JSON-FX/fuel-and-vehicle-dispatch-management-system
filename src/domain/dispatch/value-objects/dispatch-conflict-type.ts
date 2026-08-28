import { DomainError } from '@/domain/shared/errors/domain-error';

export const DISPATCH_CONFLICT_TYPES = ['DRIVER', 'VEHICLE', 'DRIVER_AND_VEHICLE'] as const;
export type DispatchConflictTypeValue = (typeof DISPATCH_CONFLICT_TYPES)[number];

export class DispatchConflictType {
  private constructor(private readonly value: DispatchConflictTypeValue) {}

  static from(value: unknown): DispatchConflictType {
    if (!DISPATCH_CONFLICT_TYPES.includes(value as DispatchConflictTypeValue)) {
      throw new DomainError(
        'INVALID_DISPATCH_CONFLICT_TYPE',
        'Dispatch conflict type must be DRIVER, VEHICLE, or DRIVER_AND_VEHICLE.',
      );
    }

    return new DispatchConflictType(value as DispatchConflictTypeValue);
  }

  toString(): DispatchConflictTypeValue {
    return this.value;
  }
}
