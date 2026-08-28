import type { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { FuelIssuanceStatus } from '@/domain/fuel/value-objects/fuel-issuance-status';
import type { FuelQuantity } from '@/domain/fuel/value-objects/fuel-quantity';
import type { FuelTotal } from '@/domain/fuel/value-objects/fuel-total';
import type { FuelType } from '@/domain/fuel/value-objects/fuel-type';
import type { PurchaseRequestNumber } from '@/domain/fuel/value-objects/purchase-request-number';
import type { RisNumber } from '@/domain/fuel/value-objects/ris-number';
import type { UnitPrice } from '@/domain/fuel/value-objects/unit-price';
import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';

export interface FuelIssuanceDetails {
  readonly purchaseRequestNumber: PurchaseRequestNumber;
  readonly entryDate: EntryDate;
  readonly driverPublicId: PublicId;
  readonly destination?: string | undefined;
  readonly purpose: string;
  readonly vehiclePublicId: PublicId;
  readonly requestedLiters: FuelQuantity | null;
  readonly isFullTank: boolean;
  readonly issuedLiters: FuelQuantity | null;
  readonly unitPrice: UnitPrice;
  readonly budgetAllocationPublicId: PublicId;
  readonly fuelType: FuelType;
}

export interface FuelIssuanceProperties extends FuelIssuanceDetails {
  readonly publicId: PublicId;
  readonly createdByActorPublicId: PublicId;
  status?: FuelIssuanceStatus;
  risNumber?: RisNumber | null;
  totalAmount?: FuelTotal | null;
  postedAt?: Date | null;
  voidedAt?: Date | null;
  voidedByActorPublicId?: PublicId | null;
  voidReason?: string | null;
  readonly createdAt: Date;
  updatedAt: Date;
}

export class FuelIssuance {
  readonly publicId: PublicId;
  purchaseRequestNumber: PurchaseRequestNumber;
  entryDate: EntryDate;
  driverPublicId: PublicId;
  destination: string;
  purpose: string;
  vehiclePublicId: PublicId;
  requestedLiters: FuelQuantity | null;
  isFullTank: boolean;
  issuedLiters: FuelQuantity | null;
  unitPrice: UnitPrice;
  budgetAllocationPublicId: PublicId;
  fuelType: FuelType;
  status: FuelIssuanceStatus;
  readonly createdByActorPublicId: PublicId;
  risNumber: RisNumber | null;
  totalAmount: FuelTotal | null;
  postedAt: Date | null;
  voidedAt: Date | null;
  voidedByActorPublicId: PublicId | null;
  voidReason: string | null;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(properties: FuelIssuanceProperties) {
    this.publicId = properties.publicId;
    this.purchaseRequestNumber = properties.purchaseRequestNumber;
    this.entryDate = properties.entryDate;
    this.driverPublicId = properties.driverPublicId;
    this.destination = normalizeRequiredText(
      properties.destination ?? 'AOR',
      255,
      'INVALID_FUEL_DESTINATION',
      'Destination',
    );
    this.purpose = normalizeRequiredText(
      properties.purpose,
      1_000,
      'INVALID_FUEL_PURPOSE',
      'Purpose',
    );
    this.vehiclePublicId = properties.vehiclePublicId;
    this.requestedLiters = properties.requestedLiters;
    this.isFullTank = properties.isFullTank;
    this.issuedLiters = properties.issuedLiters;
    this.unitPrice = properties.unitPrice;
    this.budgetAllocationPublicId = properties.budgetAllocationPublicId;
    this.fuelType = properties.fuelType;
    this.status = properties.status ?? FuelIssuanceStatus.draft();
    this.createdByActorPublicId = properties.createdByActorPublicId;
    this.risNumber = properties.risNumber ?? null;
    this.totalAmount = properties.totalAmount ?? null;
    this.postedAt = properties.postedAt ?? null;
    this.voidedAt = properties.voidedAt ?? null;
    this.voidedByActorPublicId = properties.voidedByActorPublicId ?? null;
    this.voidReason = normalizeOptionalReason(properties.voidReason ?? null);
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.assertQuantityMode();
    this.assertLifecycleEvidence();
  }

  updateDraft(details: FuelIssuanceDetails, at: Date): void {
    if (!this.status.isDraft()) {
      throw new DomainError('FUEL_ISSUANCE_NOT_DRAFT', 'Only draft fuel issuances can be edited.');
    }

    this.purchaseRequestNumber = details.purchaseRequestNumber;
    this.entryDate = details.entryDate;
    this.driverPublicId = details.driverPublicId;
    this.destination = normalizeRequiredText(
      details.destination ?? 'AOR',
      255,
      'INVALID_FUEL_DESTINATION',
      'Destination',
    );
    this.purpose = normalizeRequiredText(details.purpose, 1_000, 'INVALID_FUEL_PURPOSE', 'Purpose');
    this.vehiclePublicId = details.vehiclePublicId;
    this.requestedLiters = details.requestedLiters;
    this.isFullTank = details.isFullTank;
    this.issuedLiters = details.issuedLiters;
    this.unitPrice = details.unitPrice;
    this.budgetAllocationPublicId = details.budgetAllocationPublicId;
    this.fuelType = details.fuelType;
    this.assertQuantityMode();
    this.updatedAt = at;
  }

  post(input: {
    readonly risNumber: RisNumber;
    readonly issuedLiters: FuelQuantity;
    readonly totalAmount: FuelTotal;
    readonly at: Date;
  }): void {
    if (!this.status.isDraft()) {
      throw new DomainError('FUEL_ISSUANCE_NOT_DRAFT', 'Only draft fuel issuances can be posted.');
    }

    this.status = FuelIssuanceStatus.posted();
    this.risNumber = input.risNumber;
    this.issuedLiters = input.issuedLiters;
    this.totalAmount = input.totalAmount;
    this.postedAt = input.at;
    this.updatedAt = input.at;
  }

  void(input: {
    readonly at: Date;
    readonly actorPublicId: PublicId;
    readonly reason: string;
  }): void {
    if (!this.status.isPosted()) {
      throw new DomainError(
        'FUEL_ISSUANCE_NOT_POSTED',
        'Only posted fuel issuances can be voided.',
      );
    }

    const reason = normalizeRequiredText(
      input.reason,
      500,
      'INVALID_FUEL_VOID_REASON',
      'Void reason',
    );
    if (reason.length < 10) {
      throw new DomainError(
        'INVALID_FUEL_VOID_REASON',
        'Void reason must contain between 10 and 500 characters.',
      );
    }

    this.status = FuelIssuanceStatus.voided();
    this.voidedAt = input.at;
    this.voidedByActorPublicId = input.actorPublicId;
    this.voidReason = reason;
    this.updatedAt = input.at;
  }

  private assertQuantityMode(): void {
    if (this.isFullTank && this.requestedLiters !== null) {
      throw new DomainError(
        'INVALID_FULL_TANK_QUANTITY',
        'Full-tank fuel issuances cannot have requested liters.',
      );
    }
    if (!this.isFullTank && this.requestedLiters === null) {
      throw new DomainError(
        'MISSING_REQUESTED_LITERS',
        'Standard fuel issuances require requested liters.',
      );
    }
  }

  private assertLifecycleEvidence(): void {
    if (this.status.isDraft()) {
      if (
        this.risNumber !== null ||
        this.totalAmount !== null ||
        this.postedAt !== null ||
        this.voidedAt !== null ||
        this.voidedByActorPublicId !== null ||
        this.voidReason !== null
      ) {
        throw new DomainError(
          'INVALID_FUEL_ISSUANCE_STATE',
          'Draft fuel issuance contains terminal evidence.',
        );
      }
      return;
    }

    if (this.risNumber === null || this.issuedLiters === null || this.totalAmount === null) {
      throw new DomainError(
        'INVALID_FUEL_ISSUANCE_STATE',
        'Posted fuel issuance evidence is incomplete.',
      );
    }
    if (this.postedAt === null) {
      throw new DomainError(
        'INVALID_FUEL_ISSUANCE_STATE',
        'Posted fuel issuance timestamp is missing.',
      );
    }

    if (this.status.isPosted()) {
      if (
        this.voidedAt !== null ||
        this.voidedByActorPublicId !== null ||
        this.voidReason !== null
      ) {
        throw new DomainError(
          'INVALID_FUEL_ISSUANCE_STATE',
          'Posted fuel issuance contains void evidence.',
        );
      }
      return;
    }

    if (this.voidedAt === null || this.voidedByActorPublicId === null || this.voidReason === null) {
      throw new DomainError(
        'INVALID_FUEL_ISSUANCE_STATE',
        'Voided fuel issuance evidence is incomplete.',
      );
    }
  }
}

function normalizeRequiredText(
  value: string,
  maximumLength: number,
  code: string,
  label: string,
): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new DomainError(
      code,
      `${label} is required and must not exceed ${maximumLength} characters.`,
    );
  }
  return normalized;
}

function normalizeOptionalReason(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 10 || normalized.length > 500) {
    throw new DomainError(
      'INVALID_FUEL_VOID_REASON',
      'Void reason must contain between 10 and 500 characters.',
    );
  }
  return normalized;
}
