import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { ReportType } from '@/application/reporting/dto/report-dtos';
import { getReportDefinition } from '@/application/reporting/services/report-catalogue';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class ReportPermissionPolicy {
  canRead(principal: CurrentPrincipal, reportType: ReportType): boolean {
    return principal.permissions.includes(getReportDefinition(reportType).readPermission);
  }

  canExport(principal: CurrentPrincipal, reportType: ReportType): boolean {
    const definition = getReportDefinition(reportType);
    return (
      principal.permissions.includes(definition.readPermission) &&
      principal.permissions.includes(definition.exportPermission)
    );
  }

  canAccessDashboard(principal: CurrentPrincipal): boolean {
    return (
      principal.permissions.includes('fuel.read') || principal.permissions.includes('dispatch.read')
    );
  }

  assertCanRead(principal: CurrentPrincipal, reportType: ReportType): void {
    if (!this.canRead(principal, reportType)) throw new AuthorizationError();
  }

  assertCanExport(principal: CurrentPrincipal, reportType: ReportType): void {
    if (!this.canExport(principal, reportType)) throw new AuthorizationError();
  }
}
