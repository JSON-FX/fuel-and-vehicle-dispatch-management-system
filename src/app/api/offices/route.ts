import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { createOfficeSchema, parseMasterDataListQuery } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const query = parseMasterDataListQuery(
      'office',
      Object.fromEntries(new URL(currentRequest.url).searchParams),
    );
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'office',
      query.mode,
      requestId,
      '/api/offices',
    );
    const input = {
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      query,
    };
    return query.mode === 'admin'
      ? composition.listOffices.execute(input)
      : composition.listOperationalOfficeOptions.execute(input);
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
        'office',
        'admin',
        requestId,
        '/api/offices',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      const command = createOfficeSchema.parse(await parseJsonBody(currentRequest));
      return composition.createOffice.execute({
        context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
        command,
      });
    },
    { status: 201 },
  )(request);
}
