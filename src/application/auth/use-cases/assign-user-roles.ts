import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class AssignUserRoles {
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
    readonly rolePublicIds: readonly string[];
    readonly requestId: string;
  }): Promise<void> {
    if (
      !input.actor.permissions.includes('role.manage') ||
      input.actor.userPublicId === input.targetPublicId
    ) {
      throw new AuthorizationError();
    }
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const [target, roles] = await Promise.all([
        repositories.users.findByPublicId(input.targetPublicId),
        repositories.roles.findByPublicIds(input.rolePublicIds),
      ]);
      if (target === null) throw new NotFoundError();
      if (roles.length !== new Set(input.rolePublicIds).size) {
        throw new ValidationError([
          { field: 'rolePublicIds', reason: 'A selected role is unavailable.' },
        ]);
      }
      if (
        roles.some((role) => role.isPrivileged) &&
        !input.actor.permissions.includes('role.assign_privileged')
      ) {
        throw new AuthorizationError();
      }
      if (
        target.roles.includes('SUPER_ADMIN') &&
        !roles.some((role) => role.code === 'SUPER_ADMIN') &&
        (await repositories.users.countActiveUsersWithRole('SUPER_ADMIN')) <= 1
      ) {
        throw new BusinessRuleError('At least one active super administrator must remain.');
      }
      await repositories.roles.replaceUserRoles(input.targetPublicId, input.rolePublicIds, at);
      await repositories.sessions.revokeForUser(input.targetPublicId, at, 'roles_changed');
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.user.roles.changed',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: input.targetPublicId,
        requestId: input.requestId,
        reasonCode: null,
        metadata: { roleCount: roles.length },
        occurredAt: at,
      });
    });
  }
}
