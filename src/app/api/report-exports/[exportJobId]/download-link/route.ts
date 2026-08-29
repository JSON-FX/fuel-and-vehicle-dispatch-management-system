import { createApplicationComposition } from '@/infrastructure/composition/root';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import { parseEmptyJsonBody, reportExportJobPublicIdSchema } from '@/lib/reporting/route-schemas';
import {
  authenticateReportingRequest,
  reportRequestContext,
} from '@/lib/reporting/server-report-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { readonly params: Promise<{ readonly exportJobId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateReportingRequest(currentRequest, composition);
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    parseEmptyJsonBody(await parseJsonBody(currentRequest));
    const exportJobPublicId = reportExportJobPublicIdSchema.parse(
      (await context.params).exportJobId,
    );
    return composition.issueExportDownloadLink.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      exportJobPublicId,
    });
  })(request);
}
