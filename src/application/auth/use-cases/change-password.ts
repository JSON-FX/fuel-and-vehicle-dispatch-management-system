import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { PasswordHasher } from '@/application/auth/ports/password-hasher';
import { NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import type { PasswordPolicy } from '@/domain/user/value-objects/password-policy';
import { Username } from '@/domain/user/value-objects/username';

export class ChangePassword {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly passwordHasher: PasswordHasher;
      readonly passwordPolicy: PasswordPolicy;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly userPublicId: string;
    readonly newPassword: string;
    readonly requestId: string;
  }): Promise<void> {
    const user = await this.dependencies.transaction.execute(({ users }) =>
      users.findByPublicId(input.userPublicId),
    );
    if (user === null) throw new NotFoundError();
    this.dependencies.passwordPolicy.assertEligible(input.newPassword, {
      username: Username.from(user.username),
      email: EmailAddress.from(user.email),
    });
    const passwordHash = await this.dependencies.passwordHasher.hash(input.newPassword);
    const at = this.dependencies.clock.now();

    await this.dependencies.transaction.execute(async (repositories) => {
      if (
        !(await repositories.users.updatePassword({
          publicId: user.publicId,
          passwordHash,
          mustChangePassword: false,
          updatedAt: at,
        }))
      ) {
        throw new NotFoundError();
      }
      await repositories.sessions.revokeForUser(user.publicId, at, 'password_changed');
      await repositories.challenges.revokeForUser(user.publicId, at);
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.password.changed',
        actorPublicId: user.publicId,
        targetPublicId: user.publicId,
        requestId: input.requestId,
        reasonCode: 'self_service',
        metadata: {},
        occurredAt: at,
      });
    });
  }
}
