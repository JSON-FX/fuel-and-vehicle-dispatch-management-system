import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { OneTimeCredentialDto } from '@/application/auth/dto/user-administration-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { PasswordHasher } from '@/application/auth/ports/password-hasher';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import {
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class ResetUserPassword {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly passwordHasher: PasswordHasher;
      readonly tokenGenerator: SecureTokenGenerator;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly targetPublicId: string;
    readonly reason: string;
    readonly requestId: string;
  }): Promise<OneTimeCredentialDto> {
    assertAdministrativeReset(input.actor, input.targetPublicId, 'user.password.reset');
    if (input.reason.trim().length < 10)
      throw new ValidationError([{ field: 'reason', reason: 'Provide a specific reason.' }]);
    const target = await this.dependencies.transaction.execute(({ users }) =>
      users.findByPublicId(input.targetPublicId),
    );
    if (target === null) throw new NotFoundError();
    const temporaryPassword = this.dependencies.tokenGenerator.generateTemporaryPassword(24);
    const passwordHash = await this.dependencies.passwordHasher.hash(temporaryPassword);
    const at = this.dependencies.clock.now();

    await this.dependencies.transaction.execute(async (repositories) => {
      if (
        !(await repositories.users.updatePassword({
          publicId: input.targetPublicId,
          passwordHash,
          mustChangePassword: true,
          updatedAt: at,
        }))
      )
        throw new NotFoundError();
      await repositories.sessions.revokeForUser(
        input.targetPublicId,
        at,
        'administrator_password_reset',
      );
      await repositories.challenges.revokeForUser(input.targetPublicId, at);
      await repositories.passwordResets.record({
        publicId: this.dependencies.publicIds.generate().toString(),
        actorPublicId: input.actor.userPublicId,
        targetPublicId: input.targetPublicId,
        requestId: input.requestId,
        reason: input.reason.trim(),
        createdAt: at,
      });
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.password.reset',
        actorPublicId: input.actor.userPublicId,
        targetPublicId: input.targetPublicId,
        requestId: input.requestId,
        reasonCode: 'administrator_reset',
        metadata: { reason: input.reason.trim() },
        occurredAt: at,
      });
    });
    return { temporaryPassword, targetPublicId: input.targetPublicId };
  }
}

function assertAdministrativeReset(
  actor: CurrentPrincipal,
  targetPublicId: string,
  permission: string,
): void {
  if (!actor.permissions.includes(permission) || actor.userPublicId === targetPublicId) {
    throw new AuthorizationError();
  }
}
