import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateFuelRequest, fuelRequestContext } from '@/lib/fuel/server-fuel-access';
import { fuelSearchParams, parseFuelPreparationOptionsQuery } from '@/lib/fuel/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateFuelRequest(
      currentRequest,
      composition,
      'create',
      requestId,
      '/api/fuel-preparation-options',
    );
    const entryDate = parseFuelPreparationOptionsQuery(
      fuelSearchParams(new URL(currentRequest.url).searchParams),
    );
    return composition.getFuelPreparationOptions.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      entryDate,
    });
  })(request);
}
