import type { BudgetAllocationOfficeDto } from '@/application/budget/dto/budget-allocation-dtos';
import { BusinessRuleError, ValidationError } from '@/application/shared/errors/application-error';
import type {
  BudgetAllocation,
  BudgetAllocationDetails,
} from '@/domain/budget/entities/budget-allocation';
import type { FiscalPeriodPolicy } from '@/domain/budget/policies/fiscal-period-policy';
import { FiscalYear } from '@/domain/budget/value-objects/fiscal-year';
import { PpmpNumber } from '@/domain/budget/value-objects/ppmp-number';
import { Quarter } from '@/domain/budget/value-objects/quarter';
import type { Office } from '@/domain/office/entities/office';
import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

function fieldValue<T>(field: string, create: () => T): T {
  try {
    return create();
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ValidationError([{ field, reason: error.message }]);
    }
    throw error;
  }
}

export function budgetDetails(input: {
  readonly ppmpNumber: string;
  readonly officePublicId: string;
  readonly quarter: number;
  readonly fiscalYear: number;
}): BudgetAllocationDetails {
  return {
    ppmpNumber: fieldValue('ppmpNumber', () => PpmpNumber.from(input.ppmpNumber)),
    officePublicId: fieldValue('officePublicId', () => PublicId.from(input.officePublicId)),
    quarter: fieldValue('quarter', () => Quarter.from(input.quarter)),
    fiscalYear: fieldValue('fiscalYear', () => FiscalYear.from(input.fiscalYear)),
  };
}

export function normalizeReason(reason: string, field = 'reason'): string {
  const normalized = reason.trim().replaceAll(/\s+/g, ' ');
  if (normalized.length < 10 || normalized.length > 500) {
    throw new ValidationError([
      { field, reason: 'Provide a reason containing 10 to 500 characters.' },
    ]);
  }
  return normalized;
}

export function assertOperationalOffice(office: Office): void {
  if (!office.isOperational()) {
    throw new BusinessRuleError('A current active office is required for this operation.');
  }
}

export function officeDto(office: Office): BudgetAllocationOfficeDto {
  return {
    publicId: office.publicId.toString(),
    name: office.name.toString(),
    abbreviation: office.abbreviation.toString(),
  };
}

export function isAllocationEligible(
  allocation: BudgetAllocation,
  officeOperational: boolean,
  policy: FiscalPeriodPolicy,
  effectiveDate: Date,
): boolean {
  return (
    allocation.isOperationalState() &&
    officeOperational &&
    policy.isEligible(
      {
        fiscalYear: allocation.fiscalYear.toNumber(),
        quarter: allocation.quarter.toNumber(),
      },
      effectiveDate,
    )
  );
}

export function asBusinessRule(work: () => void): void {
  try {
    work();
  } catch (error) {
    if (error instanceof DomainError) throw new BusinessRuleError(error.message);
    throw error;
  }
}
