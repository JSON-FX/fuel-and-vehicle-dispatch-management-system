import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { EmailAddress } from '@/domain/user/value-objects/email-address';

export class UpdateUser {
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
    readonly email?: string;
    readonly fullName?: string;
    readonly isActive?: boolean;
    readonly requestId: string;
  }): Promise<void> {
    if (
      !input.actor.permissions.includes('user.manage') ||
      (input.actor.userPublicId === input.targetPublicId && input.isActive !== undefined)
    )
      throw new AuthorizationError();
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      const updated = await repositories.users.updateIdentity({
        publicId: input.targetPublicId,
        ...(input.email === undefined ? {} : { email: EmailAddress.from(input.email).toString() }),
        ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        updatedAt: at,
      });
      if (!updated) throw new NotFoundError();
      if (input.isActive !== undefined)
        await repositories.sessions.revokeForUser(input.targetPublicId, at, 'status_changed');
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.user.updated',
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
