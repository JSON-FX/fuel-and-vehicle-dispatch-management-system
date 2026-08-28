import { DomainError } from '@/domain/shared/errors/domain-error';

export const FUEL_ISSUANCE_STATUSES = ['DRAFT', 'POSTED', 'VOIDED'] as const;
export type FuelIssuanceStatusValue = (typeof FUEL_ISSUANCE_STATUSES)[number];

export class FuelIssuanceStatus {
  private constructor(private readonly value: FuelIssuanceStatusValue) {}

  static from(value: unknown): FuelIssuanceStatus {
    if (!FUEL_ISSUANCE_STATUSES.includes(value as FuelIssuanceStatusValue)) {
      throw new DomainError(
        'INVALID_FUEL_ISSUANCE_STATUS',
        'Fuel issuance status must be DRAFT, POSTED, or VOIDED.',
      );
    }
    return new FuelIssuanceStatus(value as FuelIssuanceStatusValue);
  }

  static draft(): FuelIssuanceStatus {
    return new FuelIssuanceStatus('DRAFT');
  }

  static posted(): FuelIssuanceStatus {
    return new FuelIssuanceStatus('POSTED');
  }

  static voided(): FuelIssuanceStatus {
    return new FuelIssuanceStatus('VOIDED');
  }

  isDraft(): boolean {
    return this.value === 'DRAFT';
  }

  isPosted(): boolean {
    return this.value === 'POSTED';
  }

  isVoided(): boolean {
    return this.value === 'VOIDED';
  }

  toString(): FuelIssuanceStatusValue {
    return this.value;
  }
}
