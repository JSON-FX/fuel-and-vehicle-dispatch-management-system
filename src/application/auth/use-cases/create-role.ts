import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import { AuthorizationError, ValidationError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export class CreateRole {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: CurrentPrincipal;
    readonly name: string;
    readonly isPrivileged: boolean;
    readonly permissionPublicIds: readonly string[];
    readonly requestId: string;
  }): Promise<string> {
    if (
      !input.actor.permissions.includes('role.manage') ||
      (input.isPrivileged && !input.actor.permissions.includes('role.assign_privileged'))
    )
      throw new AuthorizationError();
    const name = input.name.trim();
    if (name.length < 2 || name.length > 100) throw new ValidationError();
    const publicId = this.dependencies.publicIds.generate().toString();
    const code = `CUSTOM_${name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')}`;
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async (repositories) => {
      await repositories.roles.create({
        publicId,
        code,
        name,
        isPrivileged: input.isPrivileged,
        createdAt: at,
      });
      await repositories.permissions.replaceRolePermissions(
        publicId,
        input.permissionPublicIds,
        at,
      );
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.role.created',
          actorPublicId: input.actor.userPublicId,
          targetPublicId: null,
          requestId: input.requestId,
          reasonCode: null,
          metadata: { rolePublicId: publicId, privileged: input.isPrivileged },
          occurredAt: at,
        }),
      );
    });
    return publicId;
  }
}
