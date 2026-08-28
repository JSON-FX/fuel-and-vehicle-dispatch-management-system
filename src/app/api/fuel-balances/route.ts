import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateFuelRequest, fuelRequestContext } from '@/lib/fuel/server-fuel-access';
import { fuelSearchParams, parseFuelBalanceQuery } from '@/lib/fuel/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateFuelRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/fuel-balances',
    );
    return composition.getFuelBalances.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      query: parseFuelBalanceQuery(fuelSearchParams(new URL(currentRequest.url).searchParams)),
    });
  })(request);
}
