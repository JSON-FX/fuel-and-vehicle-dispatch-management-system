import type {
  FuelBalanceDto,
  FuelBalanceQuery,
  FuelRequestContext,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import { ValidationError } from '@/application/shared/errors/application-error';
import { EntryDate } from '@/domain/fuel/value-objects/entry-date';
import { DomainError } from '@/domain/shared/errors/domain-error';

export class GetFuelBalances {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly query: FuelBalanceQuery;
  }): Promise<readonly FuelBalanceDto[]> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    const startDate = parseDate('startDate', input.query.startDate);
    const endDate = parseDate('endDate', input.query.endDate);
    if (startDate.toString() > endDate.toString()) {
      throw new ValidationError([
        { field: 'endDate', reason: 'End date must be on or after the start date.' },
      ]);
    }
    return this.dependencies.transaction.execute((repositories) =>
      repositories.ledger.summarize(input.query),
    );
  }
}

function parseDate(field: string, value: string): EntryDate {
  try {
    return EntryDate.from(value);
  } catch (error) {
    if (error instanceof DomainError) {
      throw new ValidationError([{ field, reason: error.message }]);
    }
    throw error;
  }
}
