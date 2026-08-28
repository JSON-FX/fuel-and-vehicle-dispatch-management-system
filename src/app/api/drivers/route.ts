import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { createDriverSchema, parseMasterDataListQuery } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const query = parseMasterDataListQuery(
      'driver',
      Object.fromEntries(new URL(currentRequest.url).searchParams),
    );
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'driver',
      query.mode,
      requestId,
      '/api/drivers',
    );
    const input = {
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      query,
    };
    return query.mode === 'admin'
      ? composition.listDrivers.execute(input)
      : composition.listOperationalDriverOptions.execute(input);
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
        'driver',
        'admin',
        requestId,
        '/api/drivers',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      return composition.createDriver.execute({
        context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
        command: createDriverSchema.parse(await parseJsonBody(currentRequest)),
      });
    },
    { status: 201 },
  )(request);
}
