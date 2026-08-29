import type { Clock } from '@/application/auth/ports/clock';
import type { IssuedExportDownloadLink } from '@/application/reporting/dto/export-job-dtos';
import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import type { ExportDownloadTokenService } from '@/application/reporting/ports/export-download-token-service';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import type { ReportingTransaction } from '@/application/reporting/ports/reporting-transaction';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';

export class IssueExportDownloadLink {
  constructor(
    private readonly dependencies: {
      readonly exportJobs: ExportJobRepository;
      readonly transaction: ReportingTransaction;
      readonly requesters: ReportRequesterRepository;
      readonly permissions: ReportPermissionPolicy;
      readonly tokens: ExportDownloadTokenService;
      readonly clock: Clock;
      readonly tokenTtlMs?: number;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly exportJobPublicId: string;
  }): Promise<IssuedExportDownloadLink> {
    const requester = await this.dependencies.requesters.findByPublicId(
      input.context.principal.userPublicId,
    );
    if (requester === null || !requester.isActive || requester.deletedAt !== null) {
      throw new AuthorizationError();
    }
    const job = await this.dependencies.exportJobs.findOwn(input.exportJobPublicId, requester.id);
    if (job === null) throw new NotFoundError();
    this.dependencies.permissions.assertCanExport(input.context.principal, job.reportType);
    const at = this.dependencies.clock.now();
    if (
      job.status !== 'COMPLETED' ||
      job.storageKey === null ||
      job.fileExpiresAt === null ||
      new Date(job.fileExpiresAt) <= at
    ) {
      throw new NotFoundError();
    }

    const token = this.dependencies.tokens.issue();
    const expiresAt = new Date(
      Math.min(
        at.valueOf() + (this.dependencies.tokenTtlMs ?? 5 * 60_000),
        new Date(job.fileExpiresAt).valueOf(),
      ),
    );
    await this.dependencies.transaction.execute(async ({ exportJobs }) => {
      await exportJobs.createDownloadToken({
        exportJobId: job.id,
        userId: requester.id,
        tokenHash: token.tokenHash,
        expiresAt,
        consumedAt: null,
        createdAt: at,
      });
    });
    return {
      url: `/api/report-exports/${job.publicId}/download?token=${encodeURIComponent(token.rawToken)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
