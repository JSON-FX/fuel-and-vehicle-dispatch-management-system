import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import type { OfficeListQuery, OfficePage } from '@/application/office/dto/office-dtos';

export class ListOffices {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly query: OfficeListQuery;
  }): Promise<OfficePage> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    return this.dependencies.transaction.execute(({ offices }) => offices.listAdmin(input.query));
  }
}
