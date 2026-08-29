import { headers } from 'next/headers';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { ReportRequestContext, ReportType } from '@/application/reporting/dto/report-dtos';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import { AuthorizationError } from '@/application/shared/errors/application-error';
import type { ApplicationComposition } from '@/infrastructure/composition/root';
import { authenticateRequest, auditHeadersContext } from '@/lib/auth/authenticated-request';
import { resolveRequestId } from '@/lib/http/request-id';

type ReportingAccessComposition = Pick<
  ApplicationComposition,
  'authenticateSession' | 'authorizePermission' | 'recordAuthorizationDenial' | 'reportPermissions'
>;

export async function authenticateReportingRequest(
  request: Request,
  composition: ReportingAccessComposition,
) {
  return authenticateRequest(request, composition);
}

export async function authorizeReportRequest(
  request: Request,
  composition: ReportingAccessComposition,
  principal: CurrentPrincipal,
  reportType: ReportType,
  access: 'read' | 'export',
  requestId: string,
  routeTemplate: string,
): Promise<void> {
  try {
    if (access === 'export') composition.reportPermissions.assertCanExport(principal, reportType);
    else composition.reportPermissions.assertCanRead(principal, reportType);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const definition = getReportDefinition(reportType);
    const permission =
      access === 'read' || !principal.permissions.includes(definition.readPermission)
        ? definition.readPermission
        : definition.exportPermission;
    const context = auditHeadersContext(request.headers);
    await composition.recordAuthorizationDenial.execute({
      principal,
      permission,
      requestId,
      routeTemplate,
      sourceAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw error;
  }
}

export function reportRequestContext(
  request: Request,
  principal: CurrentPrincipal,
  requestId: string,
): ReportRequestContext {
  return { principal, requestId, ...auditHeadersContext(request.headers) };
}

export async function authorizeReportPageAccess(
  composition: ReportingAccessComposition & Pick<ApplicationComposition, 'publicIdGenerator'>,
  principal: CurrentPrincipal,
  routeTemplate: string,
): Promise<ReportRequestContext | null> {
  const requestHeaders = await headers();
  const requestId = resolveRequestId(
    requestHeaders.get('x-request-id'),
    composition.publicIdGenerator,
  );
  const context = auditHeadersContext(requestHeaders);
  if (composition.reportPermissions.canAccessDashboard(principal)) {
    return { principal, requestId, ...context };
  }
  await composition.recordAuthorizationDenial.execute({
    principal,
    permission: 'fuel.read',
    requestId,
    routeTemplate,
    sourceAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  return null;
}
