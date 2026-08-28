import type {
  DispatchRequestContext,
  DispatchScheduleQuery,
  DispatchScheduleResultDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { GetDispatchSchedule } from '@/application/dispatch/use-cases/get-dispatch-schedule';

export class GetVehicleSchedule {
  constructor(private readonly schedule: GetDispatchSchedule) {}

  execute(input: {
    readonly context: DispatchRequestContext;
    readonly vehiclePublicId: string;
    readonly query: DispatchScheduleQuery;
  }): Promise<DispatchScheduleResultDto> {
    return this.schedule.execute({
      context: input.context,
      query: { ...input.query, vehiclePublicId: input.vehiclePublicId },
    });
  }
}
