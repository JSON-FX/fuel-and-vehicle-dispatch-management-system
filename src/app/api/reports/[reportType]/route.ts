import { createApplicationComposition } from '@/infrastructure/composition/root';
import { manilaCivilDate } from '@/lib/dispatch/calendar-date';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import { parseReportRouteQuery } from '@/lib/reporting/route-schemas';
import {
  authenticateReportingRequest,
  authorizeReportRequest,
  reportRequestContext,
} from '@/lib/reporting/server-report-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { readonly params: Promise<{ readonly reportType: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const { reportType } = await context.params;
    const filters = parseReportRouteQuery(
      reportType,
      new URL(currentRequest.url).searchParams,
      manilaCivilDate(),
    );
    const authenticated = await authenticateReportingRequest(currentRequest, composition);
    await authorizeReportRequest(
      currentRequest,
      composition,
      authenticated.principal,
      filters.reportType,
      'read',
      requestId,
      '/api/reports/[reportType]',
    );
    return composition.getReport.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      filters,
    });
  })(request);
}
