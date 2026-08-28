import type {
  DispatchRequestContext,
  DispatchScheduleSettingsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class GetDispatchScheduleSettings {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  execute(input: {
    readonly context: DispatchRequestContext;
  }): Promise<DispatchScheduleSettingsDto> {
    this.dependencies.permissions.assertCanManageSettings(input.context.principal);
    return this.dependencies.transaction.execute((repositories) =>
      repositories.dispatchScheduleSettings.get(),
    );
  }
}
