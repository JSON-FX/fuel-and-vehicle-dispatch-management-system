import type {
  DispatchRequestContext,
  DispatchScheduleCandidateDto,
  DispatchScheduleConflictContextDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchUseCaseDependencies } from '@/application/dispatch/ports/dispatch-use-case-dependencies';

export class CheckDispatchScheduleAvailability {
  constructor(private readonly dependencies: DispatchUseCaseDependencies) {}

  async execute(input: {
    readonly context: DispatchRequestContext;
    readonly candidate: DispatchScheduleCandidateDto;
  }): Promise<DispatchScheduleConflictContextDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal);
    return this.dependencies.transaction.execute(async (repositories) => {
      const [settings, conflicts] = await Promise.all([
        repositories.dispatchScheduleSettings.get(),
        repositories.dispatchSchedules.findAdvisoryConflicts(input.candidate),
      ]);
      const fingerprint = this.dependencies.conflictFingerprints.create({
        schemaVersion: 1,
        policy: settings.policy,
        settingsUpdatedAt: settings.updatedAt,
        candidate: input.candidate,
        conflicts: conflicts.map((conflict) => ({
          dispatchPublicId: conflict.dispatchPublicId,
          conflictType: conflict.conflictType,
        })),
      });
      return {
        policy: settings.policy,
        canOverride:
          settings.policy === 'WARN_AND_ACK' &&
          this.dependencies.permissions.canOverrideConflict(input.context.principal),
        fingerprint,
        conflicts,
      };
    });
  }
}
