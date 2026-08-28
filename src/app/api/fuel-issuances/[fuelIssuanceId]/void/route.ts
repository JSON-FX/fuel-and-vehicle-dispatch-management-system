import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { authenticateFuelRequest, fuelRequestContext } from '@/lib/fuel/server-fuel-access';
import { fuelPublicIdSchema, voidFuelIssuanceSchema } from '@/lib/fuel/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly fuelIssuanceId: string }> };

export async function POST(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateFuelRequest(
      currentRequest,
      composition,
      'void',
      requestId,
      '/api/fuel-issuances/:fuelIssuanceId/void',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.voidFuelIssuance.execute({
      context: fuelRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: fuelPublicIdSchema.parse((await route.params).fuelIssuanceId),
      command: voidFuelIssuanceSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
