import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class AssignRolePermissions {
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
    readonly permissionPublicIds: readonly string[];
    readonly requestId: string;
  }): Promise<void> {
    if (!input.actor.permissions.includes('role.manage')) throw new AuthorizationError();
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      if ((await repositories.roles.findByPublicId(input.rolePublicId)) === null)
        throw new NotFoundError();
      await repositories.permissions.replaceRolePermissions(
        input.rolePublicId,
        input.permissionPublicIds,
        at,
      );
      const affectedUsers = await repositories.roles.userPublicIdsForRole(input.rolePublicId);
      for (const userPublicId of affectedUsers)
        await repositories.sessions.revokeForUser(userPublicId, at, 'permissions_changed');
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.role.permissions.changed',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: null,
        requestId: input.requestId,
        reasonCode: null,
        metadata: {
          rolePublicId: input.rolePublicId,
          permissionCount: input.permissionPublicIds.length,
        },
        occurredAt: at,
      });
    });
  }
}
