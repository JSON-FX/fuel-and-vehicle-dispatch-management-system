import { z } from 'zod';

import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import {
  appendAuthCookies,
  AUTH_CHALLENGE_COOKIE,
  AUTH_SESSION_COOKIE,
  deleteAuthCookie,
} from '@/lib/auth/cookies';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { createSuccessResponse } from '@/lib/http/api-response';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({ mfaRequired: z.boolean() }).strict();

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'auth.settings.manage',
      requestId,
      routeTemplate: '/api/authentication-settings',
    });
    return composition.getAuthenticationSettings.execute(principal);
  })(request);
}

export async function PATCH(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'auth.settings.manage',
      requestId,
      routeTemplate: '/api/authentication-settings',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const input = updateSchema.parse(await parseJsonBody(currentRequest));
    const result = await composition.updateAuthenticationSettings.execute({
      actor: authenticated.principal,
      mfaRequired: input.mfaRequired,
      requestId,
    });
    const response = createSuccessResponse(result, requestId);
    return result.reauthenticationRequired
      ? appendAuthCookies(response, [
          deleteAuthCookie(AUTH_SESSION_COOKIE),
          deleteAuthCookie(AUTH_CHALLENGE_COOKIE),
        ])
      : response;
  })(request);
}
