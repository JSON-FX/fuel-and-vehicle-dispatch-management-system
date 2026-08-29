import { toExportJobDto, type ExportJobDto } from '@/application/reporting/dto/export-job-dtos';
import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';

export class GetOwnExportJob {
  constructor(
    private readonly dependencies: {
      readonly exportJobs: ExportJobRepository;
      readonly requesters: ReportRequesterRepository;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly exportJobPublicId: string;
  }): Promise<ExportJobDto> {
    const requester = await this.dependencies.requesters.findByPublicId(
      input.context.principal.userPublicId,
    );
    if (requester === null || !requester.isActive || requester.deletedAt !== null) {
      throw new AuthorizationError();
    }
    const job = await this.dependencies.exportJobs.findOwn(input.exportJobPublicId, requester.id);
    if (job === null) throw new NotFoundError();
    return toExportJobDto(job);
  }
}
