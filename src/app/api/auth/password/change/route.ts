import { createApplicationComposition } from '@/infrastructure/composition/root';
import {
  authenticateChallengeRequest,
  authenticateRequest,
} from '@/lib/auth/authenticated-request';
import { AUTH_CHALLENGE_COOKIE, readAuthCookie } from '@/lib/auth/cookies';
import {
  assertSecureJsonMutation,
  loginResponse,
  parseJsonBody,
  sourceAddress,
} from '@/lib/auth/route-helpers';
import { passwordChangeSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const isChallenge = readAuthCookie(currentRequest, AUTH_CHALLENGE_COOKIE) !== null;
    const challenge = isChallenge
      ? await authenticateChallengeRequest(currentRequest, {
          authenticateChallenge: composition.authenticateChallenge,
          expectedType: 'PASSWORD_CHANGE',
        })
      : null;
    const session = isChallenge ? null : await authenticateRequest(currentRequest, composition);
    const authenticated = challenge ?? session!;
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const input = passwordChangeSchema.parse(await parseJsonBody(currentRequest));
    await composition.changePassword.execute({
      userPublicId: challenge?.userPublicId ?? session!.principal.userPublicId,
      newPassword: input.newPassword,
      requestId,
    });
    const username = challenge?.username ?? session!.principal.username;
    const result = await composition.login.execute({
      username,
      password: input.newPassword,
      sourceAddress: sourceAddress(currentRequest),
      requestId,
    });
    return loginResponse(result, requestId);
  })(request);
}
