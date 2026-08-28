import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { publicIdSchema, reasonSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly userId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.password.reset',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const { reason } = reasonSchema.parse(await parseJsonBody(currentRequest));
    return composition.resetUserPassword.execute({
      actor: authenticated.principal,
      targetPublicId: publicIdSchema.parse((await context.params).userId),
      reason,
      requestId,
    });
  })(request);
}
