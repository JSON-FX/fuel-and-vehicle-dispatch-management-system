import type {
  DispatchPreparationOptionsDto,
  DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class GetDispatchPreparationOptions {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly access?: 'create' | 'update';
  }): Promise<DispatchPreparationOptionsDto> {
    if (input.access === 'update') {
      this.dependencies.permissions.assertCanUpdate(input.context.principal);
    } else {
      this.dependencies.permissions.assertCanCreate(input.context.principal);
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
      const [offices, drivers, vehicles] = await Promise.all([
        repositories.offices.listOperational(query),
        repositories.drivers.listOperational(query),
        repositories.vehicles.listOperational(query),
      ]);
      return { offices: offices.items, drivers: drivers.items, vehicles: vehicles.items };
    });
  }
}
