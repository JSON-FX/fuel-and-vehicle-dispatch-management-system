import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { permissionIdsSchema, publicIdSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly roleId: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'role.manage',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const { permissionPublicIds } = permissionIdsSchema.parse(await parseJsonBody(currentRequest));
    await composition.assignRolePermissions.execute({
      actor: authenticated.principal,
      rolePublicId: publicIdSchema.parse((await context.params).roleId),
      permissionPublicIds,
      requestId,
    });
    return { updated: true };
  })(request);
}
