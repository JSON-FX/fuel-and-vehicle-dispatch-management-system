import type { CurrentAuthenticationDto } from '@/application/auth/dto/authentication-dtos';
import type { AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import type { AuthenticateSession } from '@/application/auth/services/authenticate-session';
import { AuthenticationError } from '@/application/shared/errors/application-error';

export class GetCurrentPrincipal {
  constructor(
    private readonly dependencies: {
      readonly authenticateSession: AuthenticateSession;
      readonly transaction: AuthTransaction;
      readonly tokenGenerator: SecureTokenGenerator;
    },
  ) {}

  async execute(bearerToken: string): Promise<CurrentAuthenticationDto> {
    const session = await this.dependencies.authenticateSession.execute(bearerToken);
    const csrfToken = this.dependencies.tokenGenerator.generateToken();
    const replaced = await this.dependencies.transaction.execute(({ sessions }) =>
      sessions.replaceCsrfTokenHash(
        session.sessionPublicId,
        this.dependencies.tokenGenerator.hashToken(csrfToken),
      ),
    );
    if (!replaced) throw new AuthenticationError();
    return { principal: session.principal, csrfToken };
  }
}
