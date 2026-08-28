import type {
  DispatchRequestContext,
  DispatchScheduleQuery,
  DispatchScheduleResultDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class GetDispatchSchedule {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly query: DispatchScheduleQuery;
  }): Promise<DispatchScheduleResultDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const [page, occupancy] = await Promise.all([
        repositories.dispatchSchedules.listSchedule(input.query),
        repositories.dispatchSchedules.getOccupancy(input.query),
      ]);
      return {
        from: input.query.from,
        to: input.query.to,
        events: page.events,
        occupancy,
        truncated: page.truncated,
      };
    });
  }
}
