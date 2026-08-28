import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateChallengeRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest }) => {
    const challenge = await authenticateChallengeRequest(currentRequest, {
      authenticateChallenge: composition.authenticateChallenge,
      expectedType: 'TOTP_ENROLLMENT',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: challenge.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    await parseJsonBody(currentRequest);
    return composition.startTotpEnrollment.execute({
      userPublicId: challenge.userPublicId,
      username: challenge.username,
    });
  })(request);
}
