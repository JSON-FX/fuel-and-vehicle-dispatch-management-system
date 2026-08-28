import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { toDriverAdminDto, type DriverAdminDto } from '@/application/driver/dto/driver-dtos';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class GetDriver {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<DriverAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'driver');
    const driver = await this.dependencies.transaction.execute(({ drivers }) =>
      drivers.findIncludingDeletedByPublicId(input.publicId),
    );
    if (driver === null) throw new NotFoundError();
    return toDriverAdminDto(driver);
  }
}
