import { createApplicationComposition } from '@/infrastructure/composition/root';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import { parseDownloadQuery, reportExportJobPublicIdSchema } from '@/lib/reporting/route-schemas';
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
    const { token } = parseDownloadQuery(new URL(currentRequest.url).searchParams);
    const result = await composition.downloadExport.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      exportJobPublicId,
      rawToken: token,
    });
    return new Response(result.stream, {
      headers: {
        'content-disposition': `attachment; filename="${safeFilename(result.filename)}"`,
        'content-length': String(result.byteLength),
        'content-type': result.mimeType,
        'x-content-type-options': 'nosniff',
      },
    });
  })(request);
}

function safeFilename(filename: string): string {
  return /^[A-Za-z0-9._-]+$/.test(filename) ? filename : 'report.xlsx';
}
