import {
  toFuelIssuanceDetailDto,
  type FuelIssuanceDetailDto,
  type FuelRequestContext,
} from '@/application/fuel/dto/fuel-dtos';
import type { FuelUseCaseDependencies } from '@/application/fuel/ports/fuel-use-case-dependencies';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class GetFuelIssuance {
  constructor(private readonly dependencies: FuelUseCaseDependencies) {}

  async execute(input: {
    readonly context: FuelRequestContext;
    readonly publicId: string;
  }): Promise<FuelIssuanceDetailDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const record = await repositories.issuances.findDetailByPublicId(input.publicId);
      if (record === null) throw new NotFoundError();
      return toFuelIssuanceDetailDto(record);
    });
  }
}
