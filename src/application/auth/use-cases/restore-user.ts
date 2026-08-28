import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class RestoreUser {
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
    readonly requestId: string;
  }): Promise<void> {
    if (!input.actor.permissions.includes('user.manage')) throw new AuthorizationError();
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async ({ users, auditEvents }) => {
      if (!(await users.restoreInactive(input.targetPublicId, at))) throw new NotFoundError();
      await auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.user.restored',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: input.targetPublicId,
          requestId: input.requestId,
          reasonCode: null,
          metadata: {},
          occurredAt: at,
        }),
      );
    });
  }
}
