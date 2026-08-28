import {
  toFuelIssuanceDto,
  type FuelIssuanceListQuery,
  type FuelIssuancePage,
  type FuelRequestContext,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';

export class ListFuelIssuances {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly query: FuelIssuanceListQuery;
  }): Promise<FuelIssuancePage> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const page = await repositories.issuances.list(input.query);
      return { ...page, items: page.items.map(toFuelIssuanceDto) };
    });
  }
}
