import type { CurrentChallengeDto } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { AuthenticateChallenge } from '@/application/auth/services/authenticate-challenge';
import { AuthenticationError } from '@/application/shared/errors/application-error';

export class GetCurrentChallenge {
  constructor(
    private readonly dependencies: {
      readonly authenticateChallenge: AuthenticateChallenge;
      readonly transaction: AuthTransaction;
      readonly tokenGenerator: SecureTokenGenerator;
    },
  ) {}

  async execute(bearerToken: string): Promise<CurrentChallengeDto> {
    const challenge = await this.dependencies.authenticateChallenge.execute(bearerToken);
    const csrfToken = this.dependencies.tokenGenerator.generateToken();
    const replaced = await this.dependencies.transaction.execute(({ challenges }) =>
      challenges.replaceCsrfTokenHash(
        challenge.challengePublicId,
        this.dependencies.tokenGenerator.hashToken(csrfToken),
      ),
    );
    if (!replaced) throw new AuthenticationError();
    return { type: challenge.type, csrfToken };
  }
}
