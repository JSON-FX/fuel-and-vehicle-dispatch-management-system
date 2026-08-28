import {
  toBudgetAllocationAdminDto,
  type BudgetAllocationAdminDto,
  type BudgetRequestContext,
  type CreateBudgetAllocationCommand,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import {
  budgetAllocationAuditSnapshot,
  buildBudgetAllocationAuditEvent,
} from '@/application/budget/services/budget-allocation-audit-events';
import {
  assertOperationalOffice,
  budgetDetails,
  officeDto,
} from '@/application/budget/services/budget-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';

export class CreateBudgetAllocation {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly command: CreateBudgetAllocationCommand;
  }): Promise<BudgetAllocationAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal);
    const details = budgetDetails(input.command);
    const at = this.dependencies.clock.now();
    const allocation = new BudgetAllocation({
      publicId: this.dependencies.publicIds.generate(),
      ...details,
      createdAt: at,
      updatedAt: at,
    });

    return this.dependencies.transaction.execute(async (repositories) => {
      const office = await repositories.offices.findCurrentByPublicIdForUpdate(
        details.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      assertOperationalOffice(office);
      await repositories.allocations.insert(allocation);
      await repositories.auditEvents.append(
        buildBudgetAllocationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'created',
          entityPublicId: allocation.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          after: budgetAllocationAuditSnapshot(allocation),
        }),
      );
      return toBudgetAllocationAdminDto(allocation, officeDto(office), false);
    });
  }
}
