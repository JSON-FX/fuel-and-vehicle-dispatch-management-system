import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class ResetUserTotp {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly targetPublicId: string;
    readonly reason: string;
    readonly requestId: string;
  }): Promise<void> {
    if (
      !input.actor.permissions.includes('user.totp.reset') ||
      input.actor.userPublicId === input.targetPublicId
    ) {
      throw new AuthorizationError();
    }
    if (input.reason.trim().length < 10)
      throw new ValidationError([{ field: 'reason', reason: 'Provide a specific reason.' }]);
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      if ((await repositories.users.findByPublicId(input.targetPublicId)) === null) {
        throw new NotFoundError();
      }
      await repositories.totpFactors.disableForUser(input.targetPublicId, at);
      await repositories.sessions.revokeForUser(
        input.targetPublicId,
        at,
        'administrator_totp_reset',
      );
      await repositories.challenges.revokeForUser(input.targetPublicId, at);
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.totp.reset',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: input.targetPublicId,
          requestId: input.requestId,
          reasonCode: 'administrator_reset',
          metadata: { reason: input.reason.trim() },
          occurredAt: at,
        }),
      );
    });
  }
}
