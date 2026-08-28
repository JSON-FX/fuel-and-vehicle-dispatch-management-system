import { DomainError } from '@/domain/shared/errors/domain-error';

export class VehicleRemarks {
  private constructor(private readonly value: string) {}

  static optional(value: string | null | undefined): VehicleRemarks | null {
    const normalized = value?.trim().replaceAll(/\s+/g, ' ') ?? '';
    if (normalized.length === 0) return null;

    if (normalized.length > 2_000) {
      throw new DomainError(
        'INVALID_VEHICLE_REMARKS',
        'Vehicle remarks must contain at most 2,000 characters.',
      );
    }
    return new VehicleRemarks(normalized);
  }

  toString(): string {
    return this.value;
  }
}
