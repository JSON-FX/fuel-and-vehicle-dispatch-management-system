import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import type {
  VehicleListQuery,
  VehicleOperationalPage,
} from '@/application/vehicle/dto/vehicle-dtos';

export class ListOperationalVehicleOptions {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly query: VehicleListQuery;
  }): Promise<VehicleOperationalPage> {
    this.dependencies.permissions.assertCanRead(input.context.principal, 'vehicle');
    return this.dependencies.transaction.execute(({ vehicles }) =>
      vehicles.listOperational(input.query),
    );
  }
}
