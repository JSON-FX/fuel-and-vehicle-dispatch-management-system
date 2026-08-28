import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import {
  authenticateDispatchRequest,
  authorizeDispatchRequestAccess,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import { dispatchPublicIdSchema, updateDispatchSchema } from '@/lib/dispatch/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly dispatchId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/dispatches/:dispatchId',
    );
    return composition.getDispatch.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: dispatchPublicIdSchema.parse((await route.params).dispatchId),
    });
  })(request);
}

export async function PATCH(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'update',
      requestId,
      '/api/dispatches/:dispatchId',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const command = updateDispatchSchema.parse(await parseJsonBody(currentRequest));
    if (command.conflictOverride !== undefined) {
      await authorizeDispatchRequestAccess(
        currentRequest,
        composition,
        authenticated.principal,
        'override',
        requestId,
        '/api/dispatches/:dispatchId',
      );
    }
    return composition.updateDraftDispatch.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: dispatchPublicIdSchema.parse((await route.params).dispatchId),
      command,
    });
  })(request);
}
