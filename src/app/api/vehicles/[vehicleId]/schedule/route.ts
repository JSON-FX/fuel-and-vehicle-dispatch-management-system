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
type Context = { readonly params: Promise<{ readonly vehicleId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateDispatchRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/vehicles/:vehicleId/schedule',
    );
    return composition.getVehicleSchedule.execute({
      context: dispatchRequestContext(currentRequest, authenticated.principal, requestId),
      vehiclePublicId: dispatchPublicIdSchema.parse((await route.params).vehicleId),
      query: parseDispatchScheduleQuery(
        dispatchSearchParams(new URL(currentRequest.url).searchParams),
      ),
    });
  })(request);
}
