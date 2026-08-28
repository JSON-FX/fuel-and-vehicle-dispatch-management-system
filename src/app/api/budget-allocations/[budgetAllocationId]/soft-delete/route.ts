import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { authenticateBudgetRequest, budgetRequestContext } from '@/lib/budget/server-budget-access';
import {
  budgetAllocationPublicIdSchema,
  budgetAllocationReasonSchema,
} from '@/lib/budget/route-schemas';
import { withResponseHandler } from '@/lib/http/with-response-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { readonly params: Promise<{ readonly budgetAllocationId: string }> };

export async function POST(request: Request, route: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateBudgetRequest(
      currentRequest,
      composition,
      'manage',
      requestId,
      '/api/budget-allocations/:budgetAllocationId/soft-delete',
    );
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const { reason } = budgetAllocationReasonSchema.parse(await parseJsonBody(currentRequest));
    await composition.softDeleteBudgetAllocation.execute({
      context: budgetRequestContext(currentRequest, authenticated.principal, requestId),
      publicId: budgetAllocationPublicIdSchema.parse((await route.params).budgetAllocationId),
      reason,
    });
    return { deleted: true };
  })(request);
}
