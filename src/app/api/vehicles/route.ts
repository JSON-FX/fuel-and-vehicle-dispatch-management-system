import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { createVehicleSchema, parseMasterDataListQuery } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const query = parseMasterDataListQuery(
      'vehicle',
      Object.fromEntries(new URL(currentRequest.url).searchParams),
    );
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'vehicle',
      query.mode,
      requestId,
      '/api/vehicles',
    );
    const input = {
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      query,
    };
    return query.mode === 'admin'
      ? composition.listVehicles.execute(input)
      : composition.listOperationalVehicleOptions.execute(input);
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
      const authenticated = await authenticateMasterDataRequest(
        currentRequest,
        composition,
        'vehicle',
        'admin',
        requestId,
        '/api/vehicles',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      return composition.createVehicle.execute({
        context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
        command: createVehicleSchema.parse(await parseJsonBody(currentRequest)),
      });
    },
    { status: 201 },
  )(request);
}
