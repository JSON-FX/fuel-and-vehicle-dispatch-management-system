import type {
  AuthenticationChallengeType,
  ChallengeAuthenticationResult,
  SessionAuthenticationResult,
} from '@/application/auth/dto/authentication-dtos';
import type { AuthenticateChallenge } from '@/application/auth/services/authenticate-challenge';
import type { AuthenticateSession } from '@/application/auth/services/authenticate-session';
import type { AuthorizePermission } from '@/application/auth/services/authorize-permission';
import {
  AuthenticationError,
  ForcedAuthenticationFlowError,
} from '@/application/shared/errors/application-error';

import { AUTH_CHALLENGE_COOKIE, AUTH_SESSION_COOKIE, readAuthCookie } from './cookies';

export interface AuthenticatedRequestDependencies {
  readonly authenticateSession: Pick<AuthenticateSession, 'execute'>;
  readonly authorizePermission: Pick<AuthorizePermission, 'execute'>;
  readonly permission?: string;
}

export interface AuthenticatedRequest extends SessionAuthenticationResult {
  readonly bearerToken: string;
}

export async function authenticateRequest(
  request: Request,
  dependencies: AuthenticatedRequestDependencies,
): Promise<AuthenticatedRequest> {
  const bearerToken = readAuthCookie(request, AUTH_SESSION_COOKIE);
  if (bearerToken === null) throw new AuthenticationError();

  const session = await dependencies.authenticateSession.execute(bearerToken);
  if (dependencies.permission !== undefined) {
    dependencies.authorizePermission.execute(session.principal, dependencies.permission);
  }

  return { ...session, bearerToken };
}

export async function authenticateChallengeRequest(
  request: Request,
  dependencies: {
    readonly authenticateChallenge: Pick<AuthenticateChallenge, 'execute'>;
    readonly expectedType?: AuthenticationChallengeType;
  },
): Promise<ChallengeAuthenticationResult & { readonly bearerToken: string }> {
  const bearerToken = readAuthCookie(request, AUTH_CHALLENGE_COOKIE);
  if (bearerToken === null) throw new AuthenticationError();

  const challenge = await dependencies.authenticateChallenge.execute(bearerToken);
  if (dependencies.expectedType !== undefined && challenge.type !== dependencies.expectedType) {
    throw new ForcedAuthenticationFlowError(challenge.type);
  }
  return { ...challenge, bearerToken };
}
