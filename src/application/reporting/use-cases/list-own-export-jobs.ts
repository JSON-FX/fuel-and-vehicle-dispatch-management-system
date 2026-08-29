import { toExportJobDto, type ExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import { AuthorizationError } from '@/application/shared/errors/application-error';

export class ListOwnExportJobs {
  constructor(
    private readonly dependencies: {
      readonly exportJobs: ExportJobRepository;
      readonly requesters: ReportRequesterRepository;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly limit: number;
  }): Promise<readonly ExportJobDto[]> {
    const requester = await this.dependencies.requesters.findByPublicId(
      input.context.principal.userPublicId,
    );
    if (requester === null || !requester.isActive || requester.deletedAt !== null) {
      throw new AuthorizationError();
    }
    const jobs = await this.dependencies.exportJobs.listOwn(requester.id, input.limit);
    return jobs.map(toExportJobDto);
  }
}
