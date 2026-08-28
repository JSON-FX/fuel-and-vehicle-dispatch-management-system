import { z } from 'zod';

import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { publicIdSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly userId: string }> };
const schema = z.object({
  reason: z.string().trim().min(3).max(200),
  sessionPublicId: publicIdSchema.optional(),
});

export async function POST(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.session.revoke',
      requestId,
      routeTemplate: '/api/users/:userId/sessions/revoke',
    });
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const { reason, sessionPublicId } = schema.parse(await parseJsonBody(currentRequest));
    const revoked = await composition.revokeUserSessions.execute({
      actor: authenticated.principal,
      targetPublicId: publicIdSchema.parse((await context.params).userId),
      reason,
      ...(sessionPublicId === undefined ? {} : { sessionPublicId }),
      requestId,
    });
    return { revoked };
  })(request);
}
