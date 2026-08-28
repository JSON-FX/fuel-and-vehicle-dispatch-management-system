import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { authenticateFuelRequest, fuelRequestContext } from '@/lib/fuel/server-fuel-access';
import { fuelPublicIdSchema, updateFuelIssuanceSchema } from '@/lib/fuel/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly fuelIssuanceId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateFuelRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/fuel-issuances/:fuelIssuanceId',
    );
    return composition.getFuelIssuance.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: fuelPublicIdSchema.parse((await route.params).fuelIssuanceId),
    });
  })(request);
}

export async function PATCH(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateFuelRequest(
      currentRequest,
      composition,
      'create',
      requestId,
      '/api/fuel-issuances/:fuelIssuanceId',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.updateDraftFuelIssuance.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: fuelPublicIdSchema.parse((await route.params).fuelIssuanceId),
      command: updateFuelIssuanceSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
