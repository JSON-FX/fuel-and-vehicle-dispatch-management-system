import type { DriverListQuery, DriverPage } from '@/application/driver/dto/driver-dtos';
import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';

export class ListDrivers {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly query: DriverListQuery;
  }): Promise<DriverPage> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    return this.dependencies.transaction.execute(({ drivers }) => drivers.listAdmin(input.query));
  }
}
