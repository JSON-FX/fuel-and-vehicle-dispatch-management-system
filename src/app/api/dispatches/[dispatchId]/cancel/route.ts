import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import {
  authenticateDispatchRequest,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import { cancelDispatchSchema, dispatchPublicIdSchema } from '@/lib/dispatch/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly dispatchId: string }> };

export async function POST(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'cancel',
      requestId,
      '/api/dispatches/:dispatchId/cancel',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.cancelDispatch.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: dispatchPublicIdSchema.parse((await route.params).dispatchId),
      command: cancelDispatchSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
