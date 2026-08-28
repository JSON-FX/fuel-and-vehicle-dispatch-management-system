import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { masterDataPublicIdSchema, updateVehicleSchema } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly vehicleId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'vehicle',
      'admin',
      requestId,
      '/api/vehicles/:vehicleId',
    );
    return composition.getVehicle.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).vehicleId),
    });
  })(request);
}

export async function PATCH(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'vehicle',
      'admin',
      requestId,
      '/api/vehicles/:vehicleId',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.updateVehicle.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).vehicleId),
      command: updateVehicleSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
