import type {
  DispatchRequestContext,
  DispatchScheduleSettingsDto,
  UpdateDispatchScheduleSettingsCommand,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';
import { buildDispatchScheduleSettingsAuditEvent } from '@/application/dispatch/services/dispatch-schedule-audit-events';

export class UpdateDispatchScheduleSettings {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly command: UpdateDispatchScheduleSettingsCommand;
  }): Promise<DispatchScheduleSettingsDto> {
    this.dependencies.permissions.assertCanManageSettings(input.context.principal);
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async (repositories) => {
      const before = await repositories.dispatchScheduleSettings.getForShare();
      if (before.policy === input.command.policy) return before;

      const after = await repositories.dispatchScheduleSettings.update({
        policy: input.command.policy,
        updatedByActorPublicId: input.context.principal.userPublicId,
        updatedAt: at,
      });
      await repositories.auditEvents.append(
        buildDispatchScheduleSettingsAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          context: input.context,
          at,
          before,
          after,
        }),
      );
      return after;
    });
  }
}
