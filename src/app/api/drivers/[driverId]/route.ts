import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { masterDataPublicIdSchema, updateDriverSchema } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly driverId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'driver',
      'admin',
      requestId,
      '/api/drivers/:driverId',
    );
    return composition.getDriver.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).driverId),
    });
  })(request);
}

export async function PATCH(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'driver',
      'admin',
      requestId,
      '/api/drivers/:driverId',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.updateDriver.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).driverId),
      command: updateDriverSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
