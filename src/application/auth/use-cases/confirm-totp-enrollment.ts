import type { LoginResult } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';
import type { Clock } from '@/application/auth/ports/clock';
import type { RateLimitKeyGenerator } from '@/application/auth/ports/rate-limit-repository';
import type { SecretEncryptor } from '@/application/auth/ports/secret-encryptor';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { TotpService } from '@/application/auth/ports/totp-service';
import {
  AuthenticationError,
  NotFoundError,
  RateLimitedError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

import { issueAuthenticatedSession } from '../services/issue-authenticated-session';

export class ConfirmTotpEnrollment {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly totp: TotpService;
      readonly encryptor: SecretEncryptor;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
      readonly tokenGenerator: SecureTokenGenerator;
      readonly rateLimitKeys: RateLimitKeyGenerator;
      readonly sessionPolicy: {
        readonly standardIdleTimeoutSeconds: number;
        readonly privilegedIdleTimeoutSeconds: number;
        readonly absoluteTimeoutSeconds: number;
        readonly privilegedSessionLimit: number;
      };
      readonly rateLimitPolicy: {
        readonly windowSeconds: number;
        readonly lockSeconds: number;
        readonly maximumFailures: number;
      };
    },
  ) {}

  async execute(input: {
    readonly userPublicId: string;
    readonly challengePublicId: string;
    readonly code: string;
    readonly requestId: string;
  }): Promise<LoginResult> {
    const at = this.dependencies.clock.now();
    const rateLimitKey = this.dependencies.rateLimitKeys.forTotp(input.challengePublicId);
    const existingRate = await this.dependencies.transaction.execute(({ rateLimits }) =>
      rateLimits.find('TOTP', rateLimitKey),
    );
    if (
      existingRate?.lockedUntil !== null &&
      existingRate?.lockedUntil !== undefined &&
      existingRate.lockedUntil > at
    ) {
      throw new RateLimitedError();
    }
    const factor = await this.dependencies.transaction.execute(({ totpFactors }) =>
      totpFactors.findForUser(input.userPublicId),
    );
    if (factor === null || factor.status !== 'PENDING') throw new NotFoundError();
    const secret = this.dependencies.encryptor.decrypt(
      factor.encryptedSecret,
      `${input.userPublicId}:${factor.publicId}`,
    );
    const counter = this.dependencies.totp.verify(secret, input.code, at);
    if (counter === null) {
      const rate = await this.dependencies.transaction.execute(
        async ({ challenges, rateLimits }) => {
          await challenges.incrementFailure(input.challengePublicId);
          return rateLimits.recordFailure({
            bucketType: 'TOTP',
            bucketKey: rateLimitKey,
            now: at,
            windowSeconds: this.dependencies.rateLimitPolicy.windowSeconds,
            lockSeconds: this.dependencies.rateLimitPolicy.lockSeconds,
            maximumFailures: this.dependencies.rateLimitPolicy.maximumFailures,
          });
        },
      );
      if (rate.lockedUntil !== null) throw new RateLimitedError();
      throw new AuthenticationError();
    }

    return this.dependencies.transaction.execute(async (repositories) => {
      if (!(await repositories.totpFactors.enable(factor.publicId, at, counter))) {
        throw new AuthenticationError();
      }
      const user = await repositories.users.findByPublicId(input.userPublicId);
      if (user === null || !(await repositories.challenges.consume(input.challengePublicId, at))) {
        throw new AuthenticationError();
      }
      await repositories.rateLimits.clear('TOTP', rateLimitKey);
      await repositories.auditEvents.append(
        buildAuthenticationAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'auth.totp.enrolled',
          actorPublicId: input.userPublicId,
          targetPublicId: input.userPublicId,
          requestId: input.requestId,
          reasonCode: null,
          metadata: { factorPublicId: factor.publicId },
          occurredAt: at,
        }),
      );
      return issueAuthenticatedSession({
        repositories,
        user: { ...user, mfaEnrolled: true },
        tokenGenerator: this.dependencies.tokenGenerator,
        publicIds: this.dependencies.publicIds,
        now: at,
        ...this.dependencies.sessionPolicy,
      });
    });
  }
}
