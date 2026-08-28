import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import {
  authenticateDispatchRequest,
  authorizeDispatchRequestAccess,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import {
  createDispatchSchema,
  dispatchSearchParams,
  parseDispatchListQuery,
} from '@/lib/dispatch/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/dispatches',
    );
    return composition.listDispatches.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      query: parseDispatchListQuery(dispatchSearchParams(new URL(currentRequest.url).searchParams)),
    });
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
      const authenticated = await authenticateDispatchRequest(
        currentRequest,
        composition,
        'create',
        requestId,
        '/api/dispatches',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      const command = createDispatchSchema.parse(await parseJsonBody(currentRequest));
      if (command.conflictOverride !== undefined) {
        await authorizeDispatchRequestAccess(
          currentRequest,
          composition,
          authenticated.principal,
          'override',
          requestId,
          '/api/dispatches',
        );
      }
      return composition.createDispatch.execute({
        context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
        command,
      });
    },
    { status: 201 },
  )(request);
}
