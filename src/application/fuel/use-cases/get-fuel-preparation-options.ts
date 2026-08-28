import type {
  FuelPreparationOptionsDto,
  FuelRequestContext,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import { ValidationError } from '@/application/shared/errors/application-error';
import { DomainError } from '@/domain/shared/errors/domain-error';

export class GetFuelPreparationOptions {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly entryDate: string;
  }): Promise<FuelPreparationOptionsDto> {
    this.dependencies.permissions.assertCanCreate(input.context.principal);
    let period;
    try {
      period = this.dependencies.fiscalPeriodPolicy.resolveCivilDate(input.entryDate);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new ValidationError([{ field: 'entryDate', reason: error.message }]);
      }
      throw error;
    }
    return this.dependencies.transaction.execute(async (repositories) => {
      const query = {
        mode: 'operational' as const,
        query: null,
        lifecycle: 'current' as const,
        status: null,
        cursor: null,
        pageSize: 200,
      };
      const [drivers, vehicles, allocations] = await Promise.all([
        repositories.drivers.listOperational(query),
        repositories.vehicles.listOperational(query),
        repositories.allocations.listOperational({
          mode: 'operational',
          query: null,
          effectiveDate: input.entryDate,
          ...period,
          cursor: null,
          pageSize: 200,
        }),
      ]);
      return { drivers: drivers.items, vehicles: vehicles.items, allocations: allocations.items };
    });
  }
}
