import {
  toBudgetAllocationAdminDto,
  type BudgetAllocationListQuery,
  type BudgetAllocationPage,
  type BudgetRequestContext,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import { isAllocationEligible } from '@/application/budget/services/budget-use-case-support';

export class ListBudgetAllocations {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly query: BudgetAllocationListQuery;
  }): Promise<BudgetAllocationPage> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    const effectiveDate = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const page = await repositories.allocations.listAdmin(input.query);
      return {
        ...page,
        items: page.items.map((record) =>
          toBudgetAllocationAdminDto(
            record.allocation,
            record.office,
            isAllocationEligible(
              record.allocation,
              record.officeOperational,
              this.dependencies.fiscalPeriodPolicy,
              effectiveDate,
            ),
          ),
        ),
      };
    });
  }
}
