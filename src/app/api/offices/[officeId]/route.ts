import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import {
  authenticateMasterDataRequest,
  masterDataRequestContext,
} from '@/lib/master-data/server-master-data-access';
import { masterDataPublicIdSchema, updateOfficeSchema } from '@/lib/master-data/route-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly officeId: string }> };

export async function GET(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'office',
      'admin',
      requestId,
      '/api/offices/:officeId',
    );
    return composition.getOffice.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).officeId),
    });
  })(request);
}

export async function PATCH(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateMasterDataRequest(
      currentRequest,
      composition,
      'office',
      'admin',
      requestId,
      '/api/offices/:officeId',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    return composition.updateOffice.execute({
      context: masterDataRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: masterDataPublicIdSchema.parse((await route.params).officeId),
      command: updateOfficeSchema.parse(await parseJsonBody(currentRequest)),
    });
  })(request);
}
