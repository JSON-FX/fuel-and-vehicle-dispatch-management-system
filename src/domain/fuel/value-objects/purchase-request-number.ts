import { DomainError } from '@/domain/shared/errors/domain-error';

export class PurchaseRequestNumber {
  private constructor(private readonly value: string) {}

  static from(value: unknown): PurchaseRequestNumber {
    if (typeof value !== 'string') {
      throw new DomainError(
        'INVALID_PURCHASE_REQUEST_NUMBER',
        'Purchase request number must be a non-empty string up to 80 characters.',
      );
    }

    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0 || normalized.length > 80) {
      throw new DomainError(
        'INVALID_PURCHASE_REQUEST_NUMBER',
        'Purchase request number must be a non-empty string up to 80 characters.',
      );
    }
    return new PurchaseRequestNumber(normalized);
  }

  toString(): string {
    return this.value;
  }
}
