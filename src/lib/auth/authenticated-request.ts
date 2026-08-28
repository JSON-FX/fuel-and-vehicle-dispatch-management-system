import { isIP } from 'node:net';

import type {
  AuthenticationChallengeType,
  ChallengeAuthenticationResult,
  SessionAuthenticationResult,
} from '@/application/auth/dto/authentication-dtos';
import type { AuthenticateChallenge } from '@/application/auth/services/authenticate-challenge';
import type { AuthenticateSession } from '@/application/auth/services/authenticate-session';
import type { AuthorizePermission } from '@/application/auth/services/authorize-permission';
import type { RecordAuthorizationDenial } from '@/application/auth/services/record-authorization-denial';
import {
  AuthenticationError,
  AuthorizationError,
  ForcedAuthenticationFlowError,
} from '@/application/shared/errors/application-error';

import { AUTH_CHALLENGE_COOKIE, AUTH_SESSION_COOKIE, readAuthCookie } from './cookies';

interface AuthenticatedRequestBaseDependencies {
  readonly authenticateSession: Pick<AuthenticateSession, 'execute'>;
  readonly authorizePermission: Pick<AuthorizePermission, 'execute'>;
}

interface AuthenticatedRequestWithoutPermission extends AuthenticatedRequestBaseDependencies {
  readonly permission?: undefined;
}

interface AuthenticatedRequestWithPermission extends AuthenticatedRequestBaseDependencies {
  readonly permission: string;
  readonly requestId: string;
  readonly routeTemplate: string;
  readonly recordAuthorizationDenial: Pick<RecordAuthorizationDenial, 'execute'>;
}

export type AuthenticatedRequestDependencies =
  AuthenticatedRequestWithoutPermission | AuthenticatedRequestWithPermission;

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
    try {
      dependencies.authorizePermission.execute(session.principal, dependencies.permission);
    } catch (error) {
      if (!(error instanceof AuthorizationError)) throw error;
      const requestContext = auditRequestContext(request);
      await dependencies.recordAuthorizationDenial.execute({
        principal: session.principal,
        permission: dependencies.permission,
        requestId: dependencies.requestId,
        routeTemplate: dependencies.routeTemplate,
        sourceAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
      });
      throw error;
    }
  }

  return { ...session, bearerToken };
}

export function auditRequestContext(request: Request): {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
} {
  return auditHeadersContext(request.headers);
}

export function auditHeadersContext(headers: Pick<Headers, 'get'>): {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
} {
  const candidate =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip')?.trim() ?? '';
  return {
    ipAddress: isIP(candidate) === 0 ? null : candidate,
    userAgent: boundedUserAgent(headers),
  };
}

function boundedUserAgent(headers: Pick<Headers, 'get'>): string | null {
  const value = headers.get('user-agent');
  return value === null || value.length === 0 ? null : value.slice(0, 512);
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
