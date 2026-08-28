import type { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import type { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import type { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import { DomainError } from '@/domain/shared/errors/domain-error';
import type { DecimalValue } from '@/domain/shared/value-objects/decimal-value';
import type { PublicId } from '@/domain/shared/value-objects/public-id';

export const FUEL_LEDGER_TRANSACTION_TYPES = [
  'OPENING',
  'RECEIPT',
  'ISSUANCE',
  'ADJUSTMENT',
] as const;
export type FuelLedgerTransactionType = (typeof FUEL_LEDGER_TRANSACTION_TYPES)[number];

export interface FuelLedgerEntryProperties {
  readonly publicId: PublicId;
  readonly fuelIssuancePublicId: PublicId | null;
  readonly fuelType: FuelType;
  readonly transactionType: FuelLedgerTransactionType;
  readonly quantity: FuelQuantity;
  readonly signedQuantity: DecimalValue;
  readonly effectiveDate: EntryDate;
  readonly reference: string;
  readonly createdAt: Date;
}

interface LinkedFuelLedgerInput {
  readonly publicId: PublicId;
  readonly fuelIssuancePublicId: PublicId;
  readonly fuelType: FuelType;
  readonly quantity: FuelQuantity;
  readonly effectiveDate: EntryDate;
  readonly reference: string;
  readonly createdAt: Date;
}

export class FuelLedgerEntry {
  readonly publicId: PublicId;
  readonly fuelIssuancePublicId: PublicId | null;
  readonly fuelType: FuelType;
  readonly transactionType: FuelLedgerTransactionType;
  readonly quantity: FuelQuantity;
  readonly signedQuantity: DecimalValue;
  readonly effectiveDate: EntryDate;
  readonly reference: string;
  readonly createdAt: Date;

  constructor(properties: FuelLedgerEntryProperties) {
    if (!FUEL_LEDGER_TRANSACTION_TYPES.includes(properties.transactionType)) {
      throw new DomainError('INVALID_FUEL_LEDGER_TYPE', 'Fuel ledger type is invalid.');
    }
    const reference = properties.reference.trim();
    if (reference.length === 0 || reference.length > 100) {
      throw new DomainError(
        'INVALID_FUEL_LEDGER_REFERENCE',
        'Fuel ledger reference must contain up to 100 characters.',
      );
    }
    if (!properties.signedQuantity.absolute().equals(properties.quantity.toDecimalValue())) {
      throw new DomainError(
        'INVALID_FUEL_LEDGER_QUANTITY',
        'Signed ledger quantity must match its absolute quantity.',
      );
    }
    if (properties.transactionType === 'ISSUANCE' && !properties.signedQuantity.isNegative()) {
      throw new DomainError(
        'INVALID_FUEL_LEDGER_SIGN',
        'Issuance ledger quantity must be negative.',
      );
    }
    if (
      (properties.transactionType === 'OPENING' || properties.transactionType === 'RECEIPT') &&
      !properties.signedQuantity.isPositive()
    ) {
      throw new DomainError(
        'INVALID_FUEL_LEDGER_SIGN',
        'Opening and receipt ledger quantities must be positive.',
      );
    }

    this.publicId = properties.publicId;
    this.fuelIssuancePublicId = properties.fuelIssuancePublicId;
    this.fuelType = properties.fuelType;
    this.transactionType = properties.transactionType;
    this.quantity = properties.quantity;
    this.signedQuantity = properties.signedQuantity;
    this.effectiveDate = properties.effectiveDate;
    this.reference = reference;
    this.createdAt = properties.createdAt;
  }

  static issuance(input: LinkedFuelLedgerInput): FuelLedgerEntry {
    return new FuelLedgerEntry({
      ...input,
      transactionType: 'ISSUANCE',
      signedQuantity: input.quantity.toDecimalValue().negate(),
    });
  }

  static voidCompensation(input: LinkedFuelLedgerInput): FuelLedgerEntry {
    return new FuelLedgerEntry({
      ...input,
      transactionType: 'ADJUSTMENT',
      signedQuantity: input.quantity.toDecimalValue(),
    });
  }
}
