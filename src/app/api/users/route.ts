import { z } from 'zod';

import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { createUserSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  query: z.string().trim().max(100).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'user.read',
    });
    const url = new URL(currentRequest.url);
    const input = listQuerySchema.parse(Object.fromEntries(url.searchParams));
    return composition.listUsers.execute({
      actor: principal,
      page: input.page,
      pageSize: input.pageSize,
      ...(input.query === undefined ? {} : { query: input.query }),
    });
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
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
      const input = createUserSchema.parse(await parseJsonBody(currentRequest));
      return composition.createUser.execute({
        actor: authenticated.principal,
        ...input,
        requestId,
      });
    },
    { status: 201 },
  )(request);
}
