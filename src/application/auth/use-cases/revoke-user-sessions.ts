import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class RevokeUserSessions {
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
    readonly reason: string;
    readonly sessionPublicId?: string;
  }): Promise<number> {
    if (!input.actor.permissions.includes('user.session.revoke')) throw new AuthorizationError();
    const at = this.dependencies.clock.now();
    return this.dependencies.transaction.execute(async ({ sessions, securityEvents }) => {
      let count: number;
      if (input.sessionPublicId === undefined) {
        count = await sessions.revokeForUser(input.targetPublicId, at, input.reason);
      } else {
        const belongsToTarget = (await sessions.listForUser(input.targetPublicId)).some(
          (session) => session.publicId === input.sessionPublicId,
        );
        if (!belongsToTarget) throw new NotFoundError();
        count = (await sessions.revoke(input.sessionPublicId, at, input.reason)) ? 1 : 0;
      }
      await securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.session.revoked',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: input.targetPublicId,
        requestId: input.requestId,
        reasonCode: input.reason,
        metadata: { count, sessionPublicId: input.sessionPublicId ?? null },
        occurredAt: at,
      });
      return count;
    });
  }
}
