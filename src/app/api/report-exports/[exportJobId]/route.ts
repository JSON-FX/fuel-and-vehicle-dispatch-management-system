import { createApplicationComposition } from '@/infrastructure/composition/root';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import { reportExportJobPublicIdSchema } from '@/lib/reporting/route-schemas';
import {
  authenticateReportingRequest,
  reportRequestContext,
} from '@/lib/reporting/server-report-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { readonly params: Promise<{ readonly exportJobId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateReportingRequest(currentRequest, composition);
    const exportJobPublicId = reportExportJobPublicIdSchema.parse(
      (await context.params).exportJobId,
    );
    return composition.getOwnExportJob.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      exportJobPublicId,
    });
  })(request);
}
