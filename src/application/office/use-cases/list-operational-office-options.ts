import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import type { OfficeListQuery, OfficeOperationalPage } from '@/application/office/dto/office-dtos';

export class ListOperationalOfficeOptions {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly query: OfficeListQuery;
  }): Promise<OfficeOperationalPage> {
    this.dependencies.permissions.assertCanRead(input.context.principal, 'office');
    return this.dependencies.transaction.execute(({ offices }) =>
      offices.listOperational(input.query),
    );
  }
}
