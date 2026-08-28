import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import type { VehicleListQuery, VehiclePage } from '@/application/vehicle/dto/vehicle-dtos';

export class ListVehicles {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly query: VehicleListQuery;
  }): Promise<VehiclePage> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    return this.dependencies.transaction.execute(({ vehicles }) => vehicles.listAdmin(input.query));
  }
}
