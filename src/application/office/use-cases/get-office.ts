import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { toOfficeAdminDto, type OfficeAdminDto } from '@/application/office/dto/office-dtos';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class GetOffice {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<OfficeAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'office');
    const office = await this.dependencies.transaction.execute(({ offices }) =>
      offices.findIncludingDeletedByPublicId(input.publicId),
    );
    if (office === null) throw new NotFoundError();
    return toOfficeAdminDto(office);
  }
}
