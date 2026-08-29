import type { Clock } from '@/application/auth/ports/clock';
import type {
  NormalizedReportFilters,
  ReportRequestContext,
  ReportResultDto,
} from '@/application/reporting/dto/report-dtos';
import type { ReportQueryRepository } from '@/application/reporting/ports/report-query-repository';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';

export class GetReport {
  constructor(
    private readonly dependencies: {
      readonly queries: ReportQueryRepository;
      readonly permissions: ReportPermissionPolicy;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly filters: NormalizedReportFilters;
  }): Promise<ReportResultDto> {
    this.dependencies.permissions.assertCanRead(input.context.principal, input.filters.reportType);
    return this.dependencies.queries.getReport(input.filters, this.dependencies.clock.now());
  }
}
