import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
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
    await this.dependencies.transaction.execute(async ({ users, securityEvents }) => {
      if (!(await users.restoreInactive(input.targetPublicId, at))) throw new NotFoundError();
      await securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.user.restored',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: input.targetPublicId,
        requestId: input.requestId,
        reasonCode: null,
        metadata: {},
        occurredAt: at,
      });
    });
  }
}
