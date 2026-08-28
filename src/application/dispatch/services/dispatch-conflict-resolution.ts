import type {
  DispatchConflictOverrideCommand,
  DispatchConflictOverrideWriteDto,
  DispatchRequestContext,
  DispatchScheduleCandidateDto,
  DispatchScheduleConflictDto,
  DispatchScheduleSettingsDto,
} from '@/application/dispatch/dto/dispatch-dtos';
import type { DispatchConflictFingerprintPort } from '@/application/dispatch/ports/dispatch-conflict-fingerprint-port';
import type { DispatchConflictOverrideRepository } from '@/application/dispatch/ports/dispatch-conflict-override-repository';
import type { DispatchPermissionPolicy } from '@/application/dispatch/services/dispatch-permission-policy';
import { buildDispatchConflictOverrideAuditEvent } from '@/application/dispatch/services/dispatch-schedule-audit-events';
import {
  AuthorizationError,
  DispatchScheduleConflictError,
  ValidationError,
  type ApplicationErrorContext,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { DispatchOverrideReason } from '@/domain/dispatch/value-objects/dispatch-override-reason';

export interface DispatchConflictResolutionResult {
  readonly overrideRows: readonly DispatchConflictOverrideWriteDto[];
  readonly auditEvent: ReturnType<typeof buildDispatchConflictOverrideAuditEvent> | null;
}

export class DispatchConflictResolutionService {
  constructor(
    private readonly dependencies: {
      readonly permissions: DispatchPermissionPolicy;
      readonly fingerprints: DispatchConflictFingerprintPort;
      readonly publicIds: PublicIdGenerator;
    },
  ) {}

  async resolve(input: {
    readonly context: DispatchRequestContext;
    readonly candidate: DispatchScheduleCandidateDto;
    readonly settings: DispatchScheduleSettingsDto;
    readonly conflicts: readonly DispatchScheduleConflictDto[];
    readonly command: DispatchConflictOverrideCommand | undefined;
    readonly dispatchPublicId: string;
    readonly allowExistingEvidence: boolean;
    readonly overrides: DispatchConflictOverrideRepository;
    readonly at: Date;
  }): Promise<DispatchConflictResolutionResult> {
    if (input.conflicts.length === 0) {
      if (input.command !== undefined) {
        throw new ValidationError([
          {
            field: 'conflictOverride',
            reason: 'Conflict acknowledgment is not valid when no schedule conflict exists.',
          },
        ]);
      }
      return { overrideRows: [], auditEvent: null };
    }

    const fingerprint = this.dependencies.fingerprints.create({
      schemaVersion: 1,
      policy: input.settings.policy,
      settingsUpdatedAt: input.settings.updatedAt,
      candidate: input.candidate,
      conflicts: input.conflicts.map((conflict) => ({
        dispatchPublicId: conflict.dispatchPublicId,
        conflictType: conflict.conflictType,
      })),
    });
    const canOverride =
      input.settings.policy === 'WARN_AND_ACK' &&
      this.dependencies.permissions.canOverrideConflict(input.context.principal);
    const conflictError = () =>
      new DispatchScheduleConflictError({
        policy: input.settings.policy,
        canOverride,
        fingerprint,
        conflicts: input.conflicts,
      } as unknown as ApplicationErrorContext);

    if (input.settings.policy === 'BLOCK') throw conflictError();

    if (input.allowExistingEvidence && input.command === undefined) {
      const coverage = await Promise.all(
        input.conflicts.map((conflict) =>
          input.overrides.hasMatchingEvidence({
            dispatchPublicId: input.dispatchPublicId,
            conflictingDispatchPublicId: conflict.dispatchPublicId,
            conflictType: conflict.conflictType,
          }),
        ),
      );
      if (coverage.every(Boolean)) return { overrideRows: [], auditEvent: null };
    }

    if (input.command === undefined) throw conflictError();
    if (!this.dependencies.permissions.canOverrideConflict(input.context.principal)) {
      throw new AuthorizationError();
    }
    if (input.command.fingerprint !== fingerprint) throw conflictError();

    let reason: DispatchOverrideReason;
    try {
      reason = DispatchOverrideReason.from(input.command.reason);
    } catch {
      throw new ValidationError([
        {
          field: 'conflictOverride.reason',
          reason: 'Conflict acknowledgment reason must contain between 10 and 500 characters.',
        },
      ]);
    }
    const overrideRows = input.conflicts.map((conflict) => ({
      publicId: this.dependencies.publicIds.generate().toString(),
      dispatchPublicId: input.dispatchPublicId,
      conflictingDispatchPublicId: conflict.dispatchPublicId,
      conflictType: conflict.conflictType,
      policy: input.settings.policy,
      reason: reason.toString(),
      acknowledgedByActorPublicId: input.context.principal.userPublicId,
      acknowledgedAt: input.at.toISOString(),
    }));
    return {
      overrideRows,
      auditEvent: buildDispatchConflictOverrideAuditEvent({
        publicId: this.dependencies.publicIds.generate().toString(),
        dispatchPublicId: input.dispatchPublicId,
        context: input.context,
        at: input.at,
        fingerprint,
        rows: overrideRows,
      }),
    };
  }
}
