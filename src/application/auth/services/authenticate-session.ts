import {
  createCurrentPrincipal,
  type SessionAuthenticationResult,
} from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import {
  AuthenticationError,
  SessionExpiredError,
} from '@/application/shared/errors/application-error';
import { Session } from '@/domain/user/entities/session';
import { PublicId } from '@/domain/shared/value-objects/public-id';

export interface AuthenticateSessionDependencies {
  readonly transaction: AuthTransaction;
  readonly tokenGenerator: SecureTokenGenerator;
  readonly clock: Clock;
  readonly policy: {
    readonly activityWriteIntervalSeconds: number;
    readonly standardIdleTimeoutSeconds: number;
    readonly privilegedIdleTimeoutSeconds: number;
  };
}

export class AuthenticateSession {
  constructor(private readonly dependencies: AuthenticateSessionDependencies) {}

  execute(bearerToken: string): Promise<SessionAuthenticationResult> {
    if (bearerToken === '') throw new AuthenticationError();
    const tokenHash = this.dependencies.tokenGenerator.hashToken(bearerToken);
    const now = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async ({ sessions, users }) => {
      const record = await sessions.findByTokenHash(tokenHash);
      if (record === null) throw new AuthenticationError();
      const session = new Session({
        publicId: PublicId.from(record.publicId),
        createdAt: record.createdAt,
        lastSeenAt: record.lastSeenAt,
        idleExpiresAt: record.idleExpiresAt,
        absoluteExpiresAt: record.absoluteExpiresAt,
        revokedAt: record.revokedAt,
        revokeReason: record.revokeReason,
        isPrivileged: record.isPrivileged,
      });
      if (session.statusAt(now) !== 'ACTIVE') throw new SessionExpiredError();

      const user = await users.findByPublicId(record.userPublicId);
      if (user === null || !user.isActive || user.deletedAt !== null)
        throw new AuthenticationError();

      if (session.needsActivityUpdate(now, this.dependencies.policy.activityWriteIntervalSeconds)) {
        const timeout = record.isPrivileged
          ? this.dependencies.policy.privilegedIdleTimeoutSeconds
          : this.dependencies.policy.standardIdleTimeoutSeconds;
        session.recordActivity(now, timeout);
        await sessions.updateActivity(record.publicId, session.lastSeenAt, session.idleExpiresAt);
      }

      return {
        sessionPublicId: record.publicId,
        csrfTokenHash: record.csrfTokenHash,
        principal: createCurrentPrincipal({
          userPublicId: user.publicId,
          username: user.username,
          fullName: user.fullName,
          roles: user.roles,
          permissions: user.permissions,
          isPrivileged: user.isPrivileged,
          mustChangePassword: user.mustChangePassword,
          mfaEnrolled: user.mfaEnrolled,
        }),
      };
    });
  }
}
