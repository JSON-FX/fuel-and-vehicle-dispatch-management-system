import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class UpdateRole {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly rolePublicId: string;
    readonly name?: string;
    readonly isPrivileged?: boolean;
    readonly isActive?: boolean;
    readonly requestId: string;
  }): Promise<void> {
    if (!input.actor.permissions.includes('role.manage')) throw new AuthorizationError();
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const role = await repositories.roles.findByPublicId(input.rolePublicId);
      if (role === null) throw new NotFoundError();
      if (
        input.isPrivileged !== undefined &&
        input.isPrivileged !== role.isPrivileged &&
        !input.actor.permissions.includes('role.assign_privileged')
      ) {
        throw new AuthorizationError();
      }
      if (
        role.code === 'SUPER_ADMIN' &&
        (input.isActive === false || input.isPrivileged === false)
      ) {
        throw new BusinessRuleError('The super-administrator role cannot be weakened.');
      }
      if (
        !(await repositories.roles.update({
          publicId: input.rolePublicId,
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.isPrivileged === undefined ? {} : { isPrivileged: input.isPrivileged }),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          updatedAt: at,
        }))
      )
        throw new NotFoundError();
      const affectedUsers = await repositories.roles.userPublicIdsForRole(input.rolePublicId);
      for (const userPublicId of affectedUsers) {
        await repositories.sessions.revokeForUser(userPublicId, at, 'role_changed');
      }
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.role.updated',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: null,
        requestId: input.requestId,
        reasonCode: null,
        metadata: { rolePublicId: input.rolePublicId },
        occurredAt: at,
      });
    });
  }
}
