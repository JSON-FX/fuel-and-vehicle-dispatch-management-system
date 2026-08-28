import { createApplicationComposition } from '@/infrastructure/composition/root';
import {
  assertSecureJsonMutation,
  loginResponse,
  parseJsonBody,
  sourceAddress,
} from '@/lib/auth/route-helpers';
import { loginSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
    });
    const input = loginSchema.parse(await parseJsonBody(currentRequest));
    const result = await composition.login.execute({
      ...input,
      sourceAddress: sourceAddress(currentRequest),
      requestId,
    });
    return loginResponse(result, requestId);
  })(request);
}
