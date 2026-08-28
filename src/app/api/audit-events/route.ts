import { createApplicationComposition } from '@/infrastructure/composition/root';
import { auditRequestContext, authenticateRequest } from '@/lib/auth/authenticated-request';
import { auditSearchQuerySchema } from '@/lib/audit/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const { principal } = await authenticateRequest(currentRequest, {
      ...composition,
      permission: 'audit.read',
      requestId,
      routeTemplate: '/api/audit-events',
    });
    const parsed = auditSearchQuerySchema.parse(
      Object.fromEntries(new URL(currentRequest.url).searchParams),
    );
    const network = auditRequestContext(currentRequest);
    return composition.searchAuditEvents.execute({
      actor: principal,
      requestId,
      ...network,
      query: {
        from: parsed.from ?? null,
        to: parsed.to ?? null,
        action: parsed.action ?? null,
        entityType: parsed.entityType ?? null,
        entityPublicId: parsed.entityPublicId ?? null,
        actorPublicId: parsed.actorPublicId ?? null,
        requestId: parsed.requestId ?? null,
        cursor: parsed.cursor ?? null,
        pageSize: parsed.pageSize,
      },
    });
  })(request);
}
