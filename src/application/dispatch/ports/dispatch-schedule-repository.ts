import type {
  DispatchResourceOccupancyDto,
  DispatchScheduleCandidateDto,
  DispatchScheduleConflictDto,
  DispatchScheduleEventDto,
  DispatchScheduleQuery,
} from '@/application/dispatch/dto/dispatch-dtos';

export interface DispatchScheduleEventPage {
  readonly events: readonly DispatchScheduleEventDto[];
  readonly truncated: boolean;
}

export interface DispatchScheduleRepository {
  findAdvisoryConflicts(
    candidate: DispatchScheduleCandidateDto,
  ): Promise<readonly DispatchScheduleConflictDto[]>;
  findCurrentConflictsForShare(
    candidate: DispatchScheduleCandidateDto,
  ): Promise<readonly DispatchScheduleConflictDto[]>;
  listSchedule(query: DispatchScheduleQuery): Promise<DispatchScheduleEventPage>;
  getOccupancy(query: DispatchScheduleQuery): Promise<readonly DispatchResourceOccupancyDto[]>;
}
