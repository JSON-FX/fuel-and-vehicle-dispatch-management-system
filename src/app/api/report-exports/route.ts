import { createApplicationComposition } from '@/infrastructure/composition/root';
import { toExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import { assertSecureJsonMutation, parseJsonBody } from '@/lib/auth/route-helpers';
import { manilaCivilDate } from '@/lib/dispatch/calendar-date';
import { createSuccessResponse } from '@/lib/http/api-response';
import { withResponseHandler } from '@/lib/http/with-response-handler';
import { parseExportJobListQuery, parseReportExportBody } from '@/lib/reporting/route-schemas';
import {
  authenticateReportingRequest,
  authorizeReportRequest,
  reportRequestContext,
} from '@/lib/reporting/server-report-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateReportingRequest(currentRequest, composition);
    const query = parseExportJobListQuery(new URL(currentRequest.url).searchParams);
    return composition.listOwnExportJobs.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      limit: query.limit,
    });
  })(request);
}

export async function POST(request: Request): Promise<Response> {
  const composition = createApplicationComposition();
  return withResponseHandler(composition, async ({ request: currentRequest, requestId }) => {
    const authenticated = await authenticateReportingRequest(currentRequest, composition);
    assertSecureJsonMutation({
      request: currentRequest,
      allowedOrigin: composition.authAllowedOrigin,
      csrfTokenHash: authenticated.csrfTokenHash,
      tokenGenerator: composition.secureTokenGenerator,
    });
    const filters = parseReportExportBody(await parseJsonBody(currentRequest), manilaCivilDate());
    await authorizeReportRequest(
      currentRequest,
      composition,
      authenticated.principal,
      filters.reportType,
      'export',
      requestId,
      '/api/report-exports',
    );
    const result = await composition.requestReportExport.execute({
      context: reportRequestContext(currentRequest, authenticated.principal, requestId),
      filters,
    });
    return createSuccessResponse(toExportJobDto(result.job), requestId, {
      status: result.httpStatus,
    });
  })(request);
}
