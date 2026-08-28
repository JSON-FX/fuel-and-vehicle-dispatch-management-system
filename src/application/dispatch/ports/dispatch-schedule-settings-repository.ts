import type {
  DispatchScheduleSettingsDto,
  UpdateDispatchScheduleSettingsCommand,
} from '@/application/dispatch/dto/dispatch-dtos';

export interface PersistDispatchScheduleSettingsCommand extends UpdateDispatchScheduleSettingsCommand {
  readonly updatedByActorPublicId: string;
  readonly updatedAt: Date;
}

export interface DispatchScheduleSettingsRepository {
  get(): Promise<DispatchScheduleSettingsDto>;
  getForShare(): Promise<DispatchScheduleSettingsDto>;
  update(command: PersistDispatchScheduleSettingsCommand): Promise<DispatchScheduleSettingsDto>;
}
