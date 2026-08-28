import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { createRoleSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'role.read',
    });
    return composition.listRoles.execute(principal);
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
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
      const input = createRoleSchema.parse(await parseJsonBody(currentRequest));
      const publicId = await composition.createRole.execute({
        actor: authenticated.principal,
        ...input,
        requestId,
      });
      return { publicId };
    },
    { status: 201 },
  )(request);
}
