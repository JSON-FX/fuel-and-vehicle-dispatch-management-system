import { createApplicationComposition } from '@/infrastructure/composition/root';
import {
  authenticateDispatchRequest,
  dispatchRequestContext,
} from '@/lib/dispatch/server-dispatch-access';
import {
  dispatchPublicIdSchema,
  dispatchSearchParams,
  parseDispatchScheduleQuery,
} from '@/lib/dispatch/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly driverId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/drivers/:driverId/schedule',
    );
    return composition.getDriverSchedule.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      driverPublicId: dispatchPublicIdSchema.parse((await route.params).driverId),
      query: parseDispatchScheduleQuery(
        dispatchSearchParams(new URL(currentRequest.url).searchParams),
      ),
    });
  })(request);
}
