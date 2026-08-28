import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateChallengeRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, loginResponse, parseJsonBody } from '@/lib/auth/route-helpers';
import { totpCodeSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const challenge = await authenticateChallengeRequest(currentRequest, {
      authenticateChallenge: composition.authenticateChallenge,
      expectedType: 'TOTP_VERIFICATION',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: challenge.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const { code } = totpCodeSchema.parse(await parseJsonBody(currentRequest));
    const result = await composition.completeTotpChallenge.execute({
      userPublicId: challenge.userPublicId,
      challengePublicId: challenge.challengePublicId,
      code,
      requestId,
    });
    return loginResponse(result, requestId);
  })(request);
}
