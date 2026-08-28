import { createApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
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
    return composition.listPermissions.execute(principal);
  })(request);
}
