import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { publicIdSchema, updateRoleSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly roleId: string }> };

export async function PATCH(request: Request, context: Context): Promise<Response> {
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
    const input = updateRoleSchema.parse(await parseJsonBody(currentRequest));
    await composition.updateRole.execute({
      actor: authenticated.principal,
      rolePublicId: publicIdSchema.parse((await context.params).roleId),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.isPrivileged === undefined ? {} : { isPrivileged: input.isPrivileged }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      requestId,
    });
    return { updated: true };
  })(request);
}
