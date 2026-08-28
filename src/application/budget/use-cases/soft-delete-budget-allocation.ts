import type { BudgetRequestContext } from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import {
  budgetAllocationAuditSnapshot,
  buildBudgetAllocationAuditEvent,
} from '@/application/budget/services/budget-allocation-audit-events';
import { normalizeReason } from '@/application/budget/services/budget-use-case-support';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export class SoftDeleteBudgetAllocation {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly publicId: string;
    readonly reason: string;
  }): Promise<void> {
    this.dependencies.permissions.assertCanManage(input.context.principal);
    const reason = normalizeReason(input.reason);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const allocation = await repositories.allocations.findCurrentByPublicIdForUpdate(
        input.publicId,
      );
      if (allocation === null) throw new NotFoundError();
      const before = budgetAllocationAuditSnapshot(allocation);
      allocation.softDelete({
        at,
        actorPublicId: PublicId.from(input.context.principal.userPublicId),
        reason,
      });
      await repositories.allocations.softDelete(allocation);
      await repositories.auditEvents.append(
        buildBudgetAllocationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'deleted',
          entityPublicId: allocation.publicId.toString(),
          actorPublicId: input.context.principal.userPublicId,
          requestId: input.context.requestId,
          ipAddress: input.context.ipAddress,
          userAgent: input.context.userAgent,
          occurredAt: at,
          reasonCode: 'soft_delete',
          before,
          metadata: { reason },
        }),
      );
    });
  }
}
