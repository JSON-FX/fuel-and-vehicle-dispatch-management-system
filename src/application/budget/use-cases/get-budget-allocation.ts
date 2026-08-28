import {
  toBudgetAllocationAdminDto,
  type BudgetAllocationAdminDto,
  type BudgetRequestContext,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import {
  isAllocationEligible,
  officeDto,
} from '@/application/budget/services/budget-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class GetBudgetAllocation {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly publicId: string;
  }): Promise<BudgetAllocationAdminDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const allocation = await repositories.allocations.findIncludingDeletedByPublicId(
        input.publicId,
      );
      if (allocation === null) throw new NotFoundError();
      const office = await repositories.offices.findIncludingDeletedByPublicId(
        allocation.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      const eligible = isAllocationEligible(
        allocation,
        office.isOperational(),
        this.dependencies.fiscalPeriodPolicy,
        this.dependencies.clock.now(),
      );
      return toBudgetAllocationAdminDto(allocation, officeDto(office), eligible);
    });
  }
}
