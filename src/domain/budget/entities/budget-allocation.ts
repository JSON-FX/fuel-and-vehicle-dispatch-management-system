import { DomainError } from '@/domain/shared/errors/domain-error';
import type { PublicId } from '@/domain/shared/value-objects/public-id';
import { BudgetAllocationStatus } from '@/domain/budget/value-objects/budget-allocation-status';
import type { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import type { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import type { Quarter } from '@/domain/budget/value-objects/quarter';

export interface BudgetAllocationDetails {
  readonly ppmpNumber: PpmpNumber;
  readonly officePublicId: PublicId;
  readonly quarter: Quarter;
  readonly fiscalYear: FiscalYear;
}

export interface BudgetAllocationProperties extends BudgetAllocationDetails {
  readonly publicId: PublicId;
  status?: BudgetAllocationStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  deletedByActorPublicId?: PublicId | null;
  deleteReason?: string | null;
}

export class BudgetAllocation {
  readonly publicId: PublicId;
  ppmpNumber: PpmpNumber;
  officePublicId: PublicId;
  quarter: Quarter;
  fiscalYear: FiscalYear;
  status: BudgetAllocationStatus;
  readonly createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedByActorPublicId: PublicId | null;
  deleteReason: string | null;

  constructor(properties: BudgetAllocationProperties) {
    this.publicId = properties.publicId;
    this.ppmpNumber = properties.ppmpNumber;
    this.officePublicId = properties.officePublicId;
    this.quarter = properties.quarter;
    this.fiscalYear = properties.fiscalYear;
    this.status = properties.status ?? BudgetAllocationStatus.draft();
    this.createdAt = properties.createdAt;
    this.updatedAt = properties.updatedAt;
    this.deletedAt = properties.deletedAt ?? null;
    this.deletedByActorPublicId = properties.deletedByActorPublicId ?? null;
    this.deleteReason = properties.deleteReason ?? null;
  }

  isOperationalState(): boolean {
    return this.deletedAt === null && this.status.isActive();
  }

  updateDetails(details: BudgetAllocationDetails, at: Date): void {
    this.assertCurrent();
    if (!this.status.isDraft()) {
      throw new DomainError(
        'BUDGET_ALLOCATION_NOT_DRAFT',
        'Only draft budget allocations can be edited.',
      );
    }

    this.ppmpNumber = details.ppmpNumber;
    this.officePublicId = details.officePublicId;
    this.quarter = details.quarter;
    this.fiscalYear = details.fiscalYear;
    this.updatedAt = at;
  }

  activate(at: Date): void {
    this.assertCurrent();
    this.status = this.status.activate();
    this.updatedAt = at;
  }

  close(at: Date): void {
    this.assertCurrent();
    this.status = this.status.close();
    this.updatedAt = at;
  }

  cancel(at: Date): void {
    this.assertCurrent();
    this.status = this.status.cancel();
    this.updatedAt = at;
  }

  softDelete(input: { at: Date; actorPublicId: PublicId; reason: string }): void {
    this.assertCurrent();
    this.deletedAt = input.at;
    this.deletedByActorPublicId = input.actorPublicId;
    this.deleteReason = input.reason;
    this.updatedAt = input.at;
  }

  restore(at: Date): void {
    if (this.deletedAt === null) {
      throw new DomainError('BUDGET_ALLOCATION_NOT_DELETED', 'Budget allocation is not deleted.');
    }

    this.status = this.status.restored();
    this.deletedAt = null;
    this.deletedByActorPublicId = null;
    this.deleteReason = null;
    this.updatedAt = at;
  }

  private assertCurrent(): void {
    if (this.deletedAt !== null) {
      throw new DomainError(
        'BUDGET_ALLOCATION_DELETED',
        'Deleted budget allocations cannot be changed.',
      );
    }
  }
}
