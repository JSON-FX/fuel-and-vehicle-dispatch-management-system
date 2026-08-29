import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import type { ReportFilterOptionsDto } from '@/application/reporting/dto/report-dtos';
import type { ReportQueryRepository } from '@/application/reporting/ports/report-query-repository';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class GetReportFilterOptions {
  constructor(
    private readonly dependencies: {
      readonly queries: ReportQueryRepository;
      readonly permissions: ReportPermissionPolicy;
    },
  ) {}

  async execute(context: ReportRequestContext): Promise<ReportFilterOptionsDto> {
    if (!this.dependencies.permissions.canAccessDashboard(context.principal)) {
      throw new AuthorizationError();
    }
    return this.dependencies.queries.getFilterOptions();
  }
}
