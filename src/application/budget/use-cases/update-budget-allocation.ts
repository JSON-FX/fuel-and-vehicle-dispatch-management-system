import {
  toBudgetAllocationAdminDto,
  type BudgetAllocationAdminDto,
  type BudgetRequestContext,
  type PatchBudgetAllocationCommand,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import {
  budgetAllocationAuditSnapshot,
  buildBudgetAllocationAuditEvent,
  type BudgetAllocationAuditAction,
} from '@/application/budget/services/budget-allocation-audit-events';
import {
  asBusinessRule,
  assertOperationalOffice,
  budgetDetails,
  isAllocationEligible,
  normalizeReason,
  officeDto,
} from '@/application/budget/services/budget-use-case-support';
import { NotFoundError, ValidationError } from '@/application/shared/errors/application-error';
import type { BudgetAllocation } from '@/domain/budget/entities/budget-allocation';

export class UpdateBudgetAllocation {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly publicId: string;
    readonly command: PatchBudgetAllocationCommand;
  }): Promise<BudgetAllocationAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal);
    if (input.command.action === 'update' && Object.keys(input.command).length === 1) {
      throw new ValidationError([
        { field: 'action', reason: 'Provide at least one draft field to update.' },
      ]);
    }
    if (input.command.action === 'cancel') normalizeReason(input.command.reason);
    const at = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async (repositories) => {
      const allocation = await repositories.allocations.findCurrentByPublicIdForUpdate(
        input.publicId,
      );
      if (allocation === null) throw new NotFoundError();
      const before = budgetAllocationAuditSnapshot(allocation);
      let action: BudgetAllocationAuditAction;
      let metadata: { readonly reason: string } | null = null;

      if (input.command.action === 'update') {
        const details = budgetDetails({
          ppmpNumber: input.command.ppmpNumber ?? allocation.ppmpNumber.toString(),
          officePublicId: input.command.officePublicId ?? allocation.officePublicId.toString(),
          quarter: input.command.quarter ?? allocation.quarter.toNumber(),
          fiscalYear: input.command.fiscalYear ?? allocation.fiscalYear.toNumber(),
        });
        if (details.officePublicId.toString() !== allocation.officePublicId.toString()) {
          const nextOffice = await repositories.offices.findCurrentByPublicIdForUpdate(
            details.officePublicId.toString(),
          );
          if (nextOffice === null) throw new NotFoundError();
          assertOperationalOffice(nextOffice);
        }
        const unchanged =
          details.ppmpNumber.toString() === allocation.ppmpNumber.toString() &&
          details.officePublicId.toString() === allocation.officePublicId.toString() &&
          details.quarter.toNumber() === allocation.quarter.toNumber() &&
          details.fiscalYear.toNumber() === allocation.fiscalYear.toNumber();
        if (unchanged) {
          throw new ValidationError([
            { field: 'action', reason: 'The update does not change any draft field.' },
          ]);
        }
        asBusinessRule(() => allocation.updateDetails(details, at));
        await repositories.allocations.updateDetails(allocation);
        action = 'updated';
      } else if (input.command.action === 'activate') {
        if (!allocation.status.isDraft()) {
          asBusinessRule(() => allocation.activate(at));
        }
        const currentOffice = await repositories.offices.findCurrentByPublicIdForUpdate(
          allocation.officePublicId.toString(),
        );
        if (currentOffice === null) throw new NotFoundError();
        assertOperationalOffice(currentOffice);
        asBusinessRule(() => allocation.activate(at));
        await repositories.allocations.updateStatus(allocation);
        action = 'activated';
      } else if (input.command.action === 'close') {
        asBusinessRule(() => allocation.close(at));
        await repositories.allocations.updateStatus(allocation);
        action = 'closed';
      } else {
        const reason = normalizeReason(input.command.reason);
        asBusinessRule(() => allocation.cancel(at));
        await repositories.allocations.updateStatus(allocation);
        action = 'cancelled';
        metadata = { reason };
      }

      await repositories.auditEvents.append(
        this.audit(input, allocation, action, at, before, metadata),
      );
      const office = await repositories.offices.findIncludingDeletedByPublicId(
        allocation.officePublicId.toString(),
      );
      if (office === null) throw new NotFoundError();
      return toBudgetAllocationAdminDto(
        allocation,
        officeDto(office),
        isAllocationEligible(
          allocation,
          office.isOperational(),
          this.dependencies.fiscalPeriodPolicy,
          at,
        ),
      );
    });
  }

  private audit(
    input: { readonly context: BudgetRequestContext },
    allocation: BudgetAllocation,
    action: BudgetAllocationAuditAction,
    occurredAt: Date,
    before: unknown,
    metadata: unknown,
  ) {
    return buildBudgetAllocationAuditEvent({
      publicId: this.dependencies.publicIds.generate().toString(),
      action,
      entityPublicId: allocation.publicId.toString(),
      actorPublicId: input.context.principal.userPublicId,
      requestId: input.context.requestId,
      ipAddress: input.context.ipAddress,
      userAgent: input.context.userAgent,
      occurredAt,
      before,
      after: budgetAllocationAuditSnapshot(allocation),
      metadata,
    });
  }
}
