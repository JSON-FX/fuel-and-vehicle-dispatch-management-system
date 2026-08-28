import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface LogoutDependencies {
  readonly transaction: AuthTransaction;
  readonly tokenGenerator: SecureTokenGenerator;
  readonly publicIds: PublicIdGenerator;
  readonly clock: Clock;
}

export class Logout {
  constructor(private readonly dependencies: LogoutDependencies) {}

  async execute(input: {
    readonly bearerToken: string;
    readonly requestId: string;
  }): Promise<void> {
    const tokenHash = this.dependencies.tokenGenerator.hashToken(input.bearerToken);
    const at = this.dependencies.clock.now();
    await this.dependencies.transaction.execute(async ({ sessions, auditEvents }) => {
      const session = await sessions.findByTokenHash(tokenHash);
      if (session === null) return;
      await sessions.revoke(session.publicId, at, 'logout');
      await auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.session.revoked',
          actorPublicId: session.userPublicId,
          targetPublicId: session.userPublicId,
          requestId: input.requestId,
          reasonCode: 'logout',
          metadata: { sessionPublicId: session.publicId },
          occurredAt: at,
        }),
      );
    });
  }
}
