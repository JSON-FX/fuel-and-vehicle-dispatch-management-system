import {
  toDispatchDetailDto,
  type DispatchListQuery,
  type DispatchPage,
  type DispatchRequestContext,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class ListDispatches {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly query: DispatchListQuery;
  }): Promise<DispatchPage> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const page = await repositories.dispatches.list(input.query);
      page.items.forEach((record) =>
        this.dependencies.permissions.assertCanRead(input.context.principal, record.dispatch),
      );
      return { ...page, items: page.items.map(toDispatchDetailDto) };
    });
  }
}
