import type {
  DispatchFilterOptionsDto,
  DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class GetDispatchFilterOptions {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
  }): Promise<DispatchFilterOptionsDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const query = {
        mode: 'operational',
        query: null,
        lifecycle: 'current',
        status: null,
        cursor: null,
        pageSize: 200,
      } as const;
      const [offices, drivers, vehicles] = await Promise.all([
        repositories.offices.listOperational(query),
        repositories.drivers.listOperational(query),
        repositories.vehicles.listOperational(query),
      ]);
      return { offices: offices.items, drivers: drivers.items, vehicles: vehicles.items };
    });
  }
}
