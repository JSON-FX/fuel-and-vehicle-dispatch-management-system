import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { authenticateBudgetRequest, budgetRequestContext } from '@/lib/budget/server-budget-access';
import {
  budgetListSearchParams,
  createBudgetAllocationSchema,
  parseBudgetAllocationListQuery,
} from '@/lib/budget/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const query = parseBudgetAllocationListQuery(
      budgetListSearchParams(new URL(currentRequest.url).searchParams),
    );
    const authenticated = await authenticateBudgetRequest(
      currentRequest,
      composition,
      'read',
      requestId,
      '/api/budget-allocations',
    );
    const context = budgetRequestContext(currentRequest, authenticated.principal, requestId);
    return query.mode === 'admin'
      ? composition.listBudgetAllocations.execute({ context, query })
      : composition.listOperationalBudgetAllocations.execute({ context, query });
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(
    composition,
    async ({ request: currentRequest, requestId }) => {
      const authenticated = await authenticateBudgetRequest(
        currentRequest,
        composition,
        'manage',
        requestId,
        '/api/budget-allocations',
      );
      assertSecureJsonMutation({
        request: currentRequest,
        allowedOrigin: composition.authAllowedOrigin,
        csrfTokenHash: authenticated.csrfTokenHash,
        tokenGenerator: composition.secureTokenGenerator,
      });
      const command = createBudgetAllocationSchema.parse(await parseJsonBody(currentRequest));
      return composition.createBudgetAllocation.execute({
        context: budgetRequestContext(currentRequest, authenticated.principal, requestId),
        command,
      });
    },
    { status: 201 },
  )(request);
}
