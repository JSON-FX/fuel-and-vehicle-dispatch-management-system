import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { appendAuthCookies, AUTH_SESSION_COOKIE, deleteAuthCookie } from '@/lib/auth/cookies';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { createSuccessResponse } from '@/lib/http/api-response';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, composition);
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    await parseJsonBody(currentRequest);
    await composition.logout.execute({ bearerToken: authenticated.bearerToken, requestId });
    return appendAuthCookies(createSuccessResponse({ loggedOut: true }, requestId), [
      deleteAuthCookie(AUTH_SESSION_COOKIE),
    ]);
  })(request);
}
