import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { BudgetAllocationStatusValue } from '@/domain/budget/value-objects/budget-allocation-status';
import type { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';

export type BudgetAllocationLifecycle = 'current' | 'deleted' | 'all';
export type BudgetAllocationMode = 'admin' | 'operational';

export interface BudgetRequestContext {
  readonly principal: CurrentPrincipal;
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface BudgetAllocationOfficeDto {
  readonly publicId: string;
  readonly name: string;
  readonly abbreviation: string;
}

export interface BudgetAllocationAdminDto {
  readonly publicId: string;
  readonly ppmpNumber: string;
  readonly office: BudgetAllocationOfficeDto;
  readonly quarter: number;
  readonly fiscalYear: number;
  readonly status: BudgetAllocationStatusValue;
  readonly operationalState: boolean;
  readonly eligible: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
  readonly deletedByActorPublicId: string | null;
  readonly deleteReason: string | null;
}

export interface BudgetAllocationOperationalOptionDto {
  readonly publicId: string;
  readonly ppmpNumber: string;
  readonly office: BudgetAllocationOfficeDto;
  readonly quarter: number;
  readonly fiscalYear: number;
}

export interface BudgetAllocationListQuery {
  readonly mode: 'admin';
  readonly query: string | null;
  readonly fiscalYear: number | null;
  readonly quarter: number | null;
  readonly status: BudgetAllocationStatusValue | null;
  readonly lifecycle: BudgetAllocationLifecycle;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface OperationalBudgetAllocationListQuery {
  readonly mode: 'operational';
  readonly query: string | null;
  readonly effectiveDate: string | null;
  readonly fiscalYear: number;
  readonly quarter: number;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export interface BudgetCursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly previousCursor: string | null;
}

export type BudgetAllocationPage = BudgetCursorPage<BudgetAllocationAdminDto>;
export type OperationalBudgetAllocationPage =
  BudgetCursorPage<BudgetAllocationOperationalOptionDto>;

export interface CreateBudgetAllocationCommand {
  readonly ppmpNumber: string;
  readonly officePublicId: string;
  readonly quarter: number;
  readonly fiscalYear: number;
}

export type PatchBudgetAllocationCommand =
  | {
      readonly action: 'update';
      readonly ppmpNumber?: string | undefined;
      readonly officePublicId?: string | undefined;
      readonly quarter?: number | undefined;
      readonly fiscalYear?: number | undefined;
    }
  | { readonly action: 'activate' }
  | { readonly action: 'close' }
  | { readonly action: 'cancel'; readonly reason: string };

export function toBudgetAllocationAdminDto(
  allocation: BudgetAllocation,
  office: BudgetAllocationOfficeDto,
  eligible: boolean,
): BudgetAllocationAdminDto {
  return {
    publicId: allocation.publicId.toString(),
    ppmpNumber: allocation.ppmpNumber.toString(),
    office,
    quarter: allocation.quarter.toNumber(),
    fiscalYear: allocation.fiscalYear.toNumber(),
    status: allocation.status.toString(),
    operationalState: allocation.isOperationalState(),
    eligible,
    createdAt: allocation.createdAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
    deletedAt: allocation.deletedAt?.toISOString() ?? null,
    deletedByActorPublicId: allocation.deletedByActorPublicId?.toString() ?? null,
    deleteReason: allocation.deleteReason,
  };
}
