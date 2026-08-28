import type {
  BudgetRequestContext,
  OperationalBudgetAllocationPage,
} from '@/application/budget/dto/budget-allocation-dtos';
import type { BudgetUseCaseDependencies } from '@/application/budget/ports/budget-use-case-dependencies';
import { ValidationError } from '@/application/shared/errors/application-error';
import { DomainError } from '@/domain/shared/errors/domain-error';

export interface OperationalBudgetAllocationQueryInput {
  readonly mode: 'operational';
  readonly query: string | null;
  readonly effectiveDate: string | null;
  readonly cursor: string | null;
  readonly pageSize: number;
}

export class ListOperationalBudgetAllocations {
  constructor(private readonly dependencies: BudgetUseCaseDependencies) {}

  async execute(input: {
    readonly context: BudgetRequestContext;
    readonly query: OperationalBudgetAllocationQueryInput;
  }): Promise<OperationalBudgetAllocationPage> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    let period;
    try {
      period =
        input.query.effectiveDate === null
          ? this.dependencies.fiscalPeriodPolicy.resolve(this.dependencies.clock.now())
          : this.dependencies.fiscalPeriodPolicy.resolveCivilDate(input.query.effectiveDate);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new ValidationError([{ field: 'effectiveDate', reason: error.message }]);
      }
      throw error;
    }

    return this.dependencies.transaction.execute((repositories) =>
      repositories.allocations.listOperational({ ...input.query, ...period }),
    );
  }
}
