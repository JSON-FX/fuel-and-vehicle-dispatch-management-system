import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthenticationSettingsRecord } from '@/application/auth/ports/authentication-settings-repository';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

import { assertSettingsPermission } from './get-authentication-settings';

export interface UpdateAuthenticationSettingsResult {
  readonly settings: AuthenticationSettingsRecord;
  readonly reauthenticationRequired: boolean;
  readonly revokedSessionCount: number;
}

export class UpdateAuthenticationSettings {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  execute(input: {
    readonly actor: CurrentPrincipal;
    readonly mfaRequired: boolean;
    readonly requestId: string;
  }): Promise<UpdateAuthenticationSettingsResult> {
    assertSettingsPermission(input.actor);
    const at = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async (repositories) => {
      const current = await repositories.authenticationSettings.get();
      if (current.mfaRequired === input.mfaRequired) {
        return {
          settings: current,
          reauthenticationRequired: false,
          revokedSessionCount: 0,
        };
      }

      const settings = await repositories.authenticationSettings.update({
        mfaRequired: input.mfaRequired,
        updatedAt: at,
        updatedByUserPublicId: input.actor.userPublicId,
      });
      const revokedSessionCount = input.mfaRequired
        ? await repositories.sessions.revokeAllPrivileged(at, 'mfa_requirement_enabled')
        : 0;
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.mfa.requirement.changed',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: null,
          requestId: input.requestId,
          reasonCode: null,
          before: { mfaRequired: current.mfaRequired },
          after: { mfaRequired: settings.mfaRequired },
          metadata: {
            previous: current.mfaRequired,
            next: settings.mfaRequired,
            revokedSessionCount,
          },
          occurredAt: at,
        }),
      );

      return {
        settings,
        reauthenticationRequired: input.mfaRequired,
        revokedSessionCount,
      };
    });
  }
}
