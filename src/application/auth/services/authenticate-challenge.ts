import type { ChallengeAuthenticationResult } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { Clock } from '@/application/auth/ports/clock';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import {
  AuthenticationError,
  SessionExpiredError,
} from '@/application/shared/errors/application-error';

export class AuthenticateChallenge {
  constructor(
    private readonly dependencies: {
      readonly transaction: AuthTransaction;
      readonly tokenGenerator: SecureTokenGenerator;
      readonly clock: Clock;
    },
  ) {}

  execute(bearerToken: string): Promise<ChallengeAuthenticationResult> {
    if (bearerToken === '') throw new AuthenticationError();
    const tokenHash = this.dependencies.tokenGenerator.hashToken(bearerToken);
    const now = this.dependencies.clock.now();

    return this.dependencies.transaction.execute(async ({ challenges, users }) => {
      const challenge = await challenges.findByTokenHash(tokenHash);
      if (challenge === null) throw new AuthenticationError();
      if (challenge.consumedAt !== null || challenge.expiresAt <= now) {
        throw new SessionExpiredError();
      }
      const user = await users.findByPublicId(challenge.userPublicId);
      if (user === null || !user.isActive || user.deletedAt !== null) {
        throw new AuthenticationError();
      }
      return {
        challengePublicId: challenge.publicId,
        userPublicId: challenge.userPublicId,
        username: user.username,
        csrfTokenHash: challenge.csrfTokenHash,
        type: challenge.type,
      };
    });
  }
}
