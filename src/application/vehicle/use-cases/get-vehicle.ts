import type { MasterDataRequestContext } from '@/application/master-data/dto/master-data-list-dtos';
import type { MasterDataUseCaseDependencies } from '@/application/master-data/ports/master-data-use-case-dependencies';
import { NotFoundError } from '@/application/shared/errors/application-error';
import { toVehicleAdminDto, type VehicleAdminDto } from '@/application/vehicle/dto/vehicle-dtos';

export class GetVehicle {
  constructor(private readonly dependencies: MasterDataUseCaseDependencies) {}

  async execute(input: {
    readonly context: MasterDataRequestContext;
    readonly publicId: string;
  }): Promise<VehicleAdminDto> {
    this.dependencies.permissions.assertCanManage(input.context.principal, 'vehicle');
    const vehicle = await this.dependencies.transaction.execute(({ vehicles }) =>
      vehicles.findIncludingDeletedByPublicId(input.publicId),
    );
    if (vehicle === null) throw new NotFoundError();
    return toVehicleAdminDto(vehicle);
  }
}
