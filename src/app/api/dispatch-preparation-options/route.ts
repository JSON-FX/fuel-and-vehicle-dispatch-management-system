import { createApplicationComposition } from '@/infrastructure/composition/root';
import {
  authenticateDispatchRequest,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'create',
      requestId,
      '/api/dispatch-preparation-options',
    );
    return composition.getDispatchPreparationOptions.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
    });
  })(request);
}
