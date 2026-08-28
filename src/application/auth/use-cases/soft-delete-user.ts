import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class SoftDeleteUser {
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
      !input.actor.permissions.includes('user.manage') ||
      input.actor.userPublicId === input.targetPublicId
    ) {
      throw new AuthorizationError();
    }
    if (input.reason.trim().length < 10)
      throw new ValidationError([{ field: 'reason', reason: 'Provide a specific reason.' }]);
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const target = await repositories.users.findByPublicId(input.targetPublicId);
      if (target === null) throw new NotFoundError();
      if (
        target.roles.includes('SUPER_ADMIN') &&
        (await repositories.users.countActiveUsersWithRole('SUPER_ADMIN')) <= 1
      ) {
        throw new BusinessRuleError('At least one active super administrator must remain.');
      }
      if (!(await repositories.users.softDelete(input.targetPublicId, at)))
        throw new NotFoundError();
      await repositories.sessions.revokeForUser(input.targetPublicId, at, 'user_deleted');
      await repositories.challenges.revokeForUser(input.targetPublicId, at);
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.user.deleted',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: input.targetPublicId,
          requestId: input.requestId,
          reasonCode: 'soft_delete',
          metadata: { reason: input.reason.trim() },
          occurredAt: at,
        }),
      );
    });
  }
}
