import type {
  CurrentPrincipal,
  IssuedBrowserCredential,
  LoginResult,
} from '@/application/auth/dto/authentication-dtos';
import type { SecureTokenGenerator } from '@/application/auth/ports/secure-token-generator';
import { ValidationError } from '@/application/shared/errors/application-error';
import { createSuccessResponse } from '@/lib/http/api-response';

import {
  appendAuthCookies,
  AUTH_CHALLENGE_COOKIE,
  AUTH_SESSION_COOKIE,
  createAuthCookie,
  deleteAuthCookie,
} from './cookies';
import { assertJsonContentType, assertTrustedMutationOrigin, verifyCsrfToken } from './csrf';

export function assertSecureJsonMutation(input: {
  readonly request: Request;
  readonly allowedOrigin: string;
  readonly csrfTokenHash?: Uint8Array;
  readonly tokenGenerator?: Pick<SecureTokenGenerator, 'hashToken'>;
}): void {
  assertJsonContentType(input.request);
  assertTrustedMutationOrigin(input.request, input.allowedOrigin);
  if (input.csrfTokenHash !== undefined && input.tokenGenerator !== undefined) {
    verifyCsrfToken(input.request, input.csrfTokenHash, input.tokenGenerator);
  }
}

export function loginResponse(result: LoginResult, requestId: string): Response {
  const isSession = result.next === 'AUTHENTICATED';
  const data: {
    next: LoginResult['next'];
    csrfToken: string;
    expiresAt: string;
    principal?: CurrentPrincipal;
  } = {
    next: result.next,
    csrfToken: result.credential.csrfToken,
    expiresAt: result.credential.expiresAt.toISOString(),
    ...(result.principal === undefined ? {} : { principal: result.principal }),
  };
  const response = createSuccessResponse(data, requestId);
  return appendAuthCookies(response, [
    deleteAuthCookie(AUTH_SESSION_COOKIE),
    deleteAuthCookie(AUTH_CHALLENGE_COOKIE),
    createCredentialCookie(result.credential, isSession),
  ]);
}

export function sourceAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',', 1)[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError([{ field: 'body', reason: 'The request body must be valid JSON.' }]);
  }
}

function createCredentialCookie(credential: IssuedBrowserCredential, isSession: boolean) {
  return createAuthCookie(
    isSession ? AUTH_SESSION_COOKIE : AUTH_CHALLENGE_COOKIE,
    credential.bearerToken,
    credential.expiresAt,
  );
}
