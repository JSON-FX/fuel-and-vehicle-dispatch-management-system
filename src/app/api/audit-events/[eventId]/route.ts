import { createApplicationComposition } from '@/infrastructure/composition/root';
import { auditRequestContext, authenticateRequest } from '@/lib/auth/authenticated-request';
import { publicIdSchema } from '@/lib/auth/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { readonly params: Promise<{ readonly eventId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'audit.read',
      requestId,
      routeTemplate: '/api/audit-events/:eventId',
    });
    const network = auditRequestContext(currentRequest);
    return composition.getAuditEvent.execute({
      actor: principal,
      eventPublicId: publicIdSchema.parse((await context.params).eventId),
      requestId,
      ...network,
    });
  })(request);
}
