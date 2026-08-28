import {
  toDispatchDetailDto,
  type DispatchDetailDto,
  type DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import { NotFoundError } from '@/application/shared/errors/application-error';

export class GetDispatch {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly publicId: string;
  }): Promise<DispatchDetailDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const record = await repositories.dispatches.findByPublicId(input.publicId);
      if (record === null) throw new NotFoundError();
      this.dependencies.permissions.assertCanRead(input.context.principal, record.dispatch);
      const conflictAcknowledgments = await repositories.dispatchConflictOverrides.listForDispatch(
        input.publicId,
      );
      return { ...toDispatchDetailDto(record), conflictAcknowledgments };
    });
  }
}
