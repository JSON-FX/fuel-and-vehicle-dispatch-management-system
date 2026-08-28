import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { authenticateFuelRequest, fuelRequestContext } from '@/lib/fuel/server-fuel-access';
import {
  createFuelIssuanceSchema,
  fuelSearchParams,
  parseFuelIssuanceListQuery,
} from '@/lib/fuel/route-schemas';
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
      '/api/fuel-issuances',
    );
    return composition.listFuelIssuances.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      query: parseFuelIssuanceListQuery(fuelSearchParams(new URL(currentRequest.url).searchParams)),
    });
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
      const authenticated = await authenticateFuelRequest(
        currentRequest,
        composition,
        'create',
        requestId,
        '/api/fuel-issuances',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      return composition.createFuelIssuance.execute({
        context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
        command: createFuelIssuanceSchema.parse(await parseJsonBody(currentRequest)),
      });
    },
    { status: 201 },
  )(request);
}
