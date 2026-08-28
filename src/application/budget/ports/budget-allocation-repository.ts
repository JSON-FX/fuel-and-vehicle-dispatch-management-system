import type {
  BudgetAllocationOfficeDto,
  BudgetAllocationListQuery,
  BudgetCursorPage,
  OperationalBudgetAllocationListQuery,
  OperationalBudgetAllocationPage,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';

export interface BudgetAllocationAdminRecord {
  readonly allocation: BudgetAllocation;
  readonly office: BudgetAllocationOfficeDto;
  readonly officeOperational: boolean;
}

export type BudgetAllocationAdminRecordPage = BudgetCursorPage<BudgetAllocationAdminRecord>;

export interface BudgetAllocationRepository {
  findCurrentByPublicId(publicId: string): Promise<BudgetAllocation | null>;
  findIncludingDeletedByPublicId(publicId: string): Promise<BudgetAllocation | null>;
  findCurrentByPublicIdForUpdate(publicId: string): Promise<BudgetAllocation | null>;
  findDeletedByPublicIdForUpdate(publicId: string): Promise<BudgetAllocation | null>;
  insert(allocation: BudgetAllocation): Promise<void>;
  updateDetails(allocation: BudgetAllocation): Promise<void>;
  updateStatus(allocation: BudgetAllocation): Promise<void>;
  softDelete(allocation: BudgetAllocation): Promise<void>;
  restore(allocation: BudgetAllocation): Promise<void>;
  listAdmin(query: BudgetAllocationListQuery): Promise<BudgetAllocationAdminRecordPage>;
  listOperational(
    query: OperationalBudgetAllocationListQuery,
  ): Promise<OperationalBudgetAllocationPage>;
}
