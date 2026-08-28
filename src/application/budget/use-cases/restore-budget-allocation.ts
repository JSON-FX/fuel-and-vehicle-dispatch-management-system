import {
  toBudgetAllocationAdminDto,
  type BudgetAllocationAdminDto,
  type BudgetRequestContext,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import {
  budgetAllocationAuditSnapshot,
  buildBudgetAllocationAuditEvent,
} from '@/application/budget/services/budget-allocation-audit-events';
import { asBusinessRule, officeDto } from '@/application/budget/services/budget-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class RestoreBudgetAllocation {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly publicId: string;
  }): Promise<BudgetAllocationAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const allocation = await repositories.allocations.findDeletedByPublicIdForUpdate(
        input.publicId,
      );
      if (allocation === null) throw new NotFoundError();
      const before = budgetAllocationAuditSnapshot(allocation);
      asBusinessRule(() => allocation.restore(at));
      await repositories.allocations.restore(allocation);
      await repositories.auditEvents.append(
        buildBudgetAllocationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'restored',
          entityPublicId: allocation.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'restore',
          before,
          after: budgetAllocationAuditSnapshot(allocation),
        }),
      );
      const office = await repositories.offices.findIncludingDeletedByPublicId(
        allocation.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      return toBudgetAllocationAdminDto(allocation, officeDto(office), false);
    });
  }
}
