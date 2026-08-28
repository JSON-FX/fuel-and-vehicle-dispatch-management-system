import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { publicIdSchema, reasonSchema, updateUserSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { readonly params: Promise<{ readonly userId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.read',
    });
    const userId = publicIdSchema.parse((await context.params).userId);
    return composition.getUser.execute(principal, userId);
  })(request);
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.manage',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const targetPublicId = publicIdSchema.parse((await context.params).userId);
    const input = updateUserSchema.parse(await parseJsonBody(currentRequest));
    await composition.updateUser.execute({
      actor: authenticated.principal,
      targetPublicId,
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      requestId,
    });
    return { updated: true };
  })(request);
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.manage',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const targetPublicId = publicIdSchema.parse((await context.params).userId);
    const { reason } = reasonSchema.parse(await parseJsonBody(currentRequest));
    await composition.softDeleteUser.execute({
      actor: authenticated.principal,
      targetPublicId,
      reason,
      requestId,
    });
    return { deleted: true };
  })(request);
}
