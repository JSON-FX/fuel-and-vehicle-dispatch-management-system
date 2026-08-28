import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { OneTimeCredentialDto } from '@/application/auth/dto/user-administration-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import type { PasswordHasher } from '@/application/auth/ports/password-hasher';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { AuthorizationError, ValidationError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { EmailAddress } from '@/domain/user/value-objects/email-address';
import { Username } from '@/domain/user/value-objects/username';

export class CreateUser {
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
    readonly username: string;
    readonly email: string;
    readonly fullName: string;
    readonly rolePublicIds: readonly string[];
    readonly requestId: string;
  }): Promise<OneTimeCredentialDto> {
    requirePermission(input.actor, 'user.manage');
    const username = Username.from(input.username).toString();
    const email = EmailAddress.from(input.email).toString();
    const fullName = input.fullName.trim();
    if (fullName.length < 2 || fullName.length > 200) {
      throw new ValidationError([{ field: 'fullName', reason: 'Enter a valid full name.' }]);
    }
    const roles = await this.dependencies.transaction.execute(({ roles }) =>
      roles.findByPublicIds(input.rolePublicIds),
    );
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

    const temporaryPassword = this.dependencies.tokenGenerator.generateTemporaryPassword(24);
    const passwordHash = await this.dependencies.passwordHasher.hash(temporaryPassword);
    const publicId = this.dependencies.publicIds.generate().toString();
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      await repositories.users.create({
        publicId,
        username,
        email,
        fullName,
        passwordHash,
        mustChangePassword: true,
        createdAt: at,
      });
      await repositories.roles.replaceUserRoles(publicId, input.rolePublicIds, at);
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.user.created',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: publicId,
          requestId: input.requestId,
          reasonCode: null,
          metadata: {},
          occurredAt: at,
        }),
      );
    });
    return { temporaryPassword, targetPublicId: publicId };
  }
}

function requirePermission(principal: CurrentPrincipal, permission: string): void {
  if (!principal.permissions.includes(permission)) throw new AuthorizationError();
}
