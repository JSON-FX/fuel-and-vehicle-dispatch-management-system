import type { OneTimeCredentialDto } from '@/application/auth/dto/user-administration-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { PasswordHasher } from '@/application/auth/ports/password-hasher';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { ConflictError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import { Username } from '@/domain/user/value-objects/username';

export class CreateInitialSuperAdmin {
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
    readonly fullName: string;
    readonly username: string;
    readonly email: string;
    readonly requestId: string;
  }): Promise<OneTimeCredentialDto & { readonly username: string }> {
    const username = Username.from(input.username).toString();
    const email = EmailAddress.from(input.email).toString();
    const fullName = input.fullName.trim();
    const temporaryPassword = this.dependencies.tokenGenerator.generateTemporaryPassword(24);
    const passwordHash = await this.dependencies.passwordHasher.hash(temporaryPassword);
    const publicId = this.dependencies.publicIds.generate().toString();
    const at = this.dependencies.clock.now();

    await this.dependencies.transaction.execute(async (repositories) => {
      if ((await repositories.users.countActiveUsersWithRole('SUPER_ADMIN')) > 0) {
        throw new ConflictError('An initial super administrator already exists.');
      }
      const role = (await repositories.roles.list()).find(
        (candidate) => candidate.code === 'SUPER_ADMIN' && candidate.isActive,
      );
      if (role === undefined)
        throw new ConflictError('The super-administrator role is unavailable.');
      await repositories.users.create({
        publicId,
        username,
        email,
        fullName,
        passwordHash,
        mustChangePassword: true,
        createdAt: at,
      });
      await repositories.roles.replaceUserRoles(publicId, [role.publicId], at);
      await repositories.securityEvents.append({
        publicId: this.dependencies.publicIds.generate().toString(),
        type: 'auth.initial_super_admin.created',
        actorPublicId: null,
        targetPublicId: publicId,
        requestId: input.requestId,
        reasonCode: 'initial_bootstrap',
        metadata: {},
        occurredAt: at,
      });
    });

    return { targetPublicId: publicId, temporaryPassword, username };
  }
}
