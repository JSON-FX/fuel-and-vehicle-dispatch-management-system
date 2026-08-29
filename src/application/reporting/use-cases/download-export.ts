import type { Clock } from '@/application/auth/ports/clock';
import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import type { ExportDownloadTokenService } from '@/application/reporting/ports/export-download-token-service';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { PrivateExportStorage } from '@/application/reporting/ports/private-export-storage';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import type { ReportingTransaction } from '@/application/reporting/ports/reporting-transaction';
import { buildReportExportAuditEvent } from '@/application/reporting/services/report-audit-events';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { AuthorizationError, NotFoundError } from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface DownloadedExport {
  readonly filename: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly stream: ReadableStream<Uint8Array>;
}

export class DownloadExport {
  constructor(
    private readonly dependencies: {
      readonly exportJobs: ExportJobRepository;
      readonly transaction: ReportingTransaction;
      readonly requesters: ReportRequesterRepository;
      readonly permissions: ReportPermissionPolicy;
      readonly tokens: ExportDownloadTokenService;
      readonly storage: PrivateExportStorage;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly exportJobPublicId: string;
    readonly rawToken: string;
  }): Promise<DownloadedExport> {
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
      job.filename === null ||
      job.mimeType === null ||
      job.fileExpiresAt === null ||
      new Date(job.fileExpiresAt) <= at
    ) {
      throw new NotFoundError();
    }

    let privateFile;
    try {
      privateFile = await this.dependencies.storage.open(job.storageKey);
    } catch {
      throw new NotFoundError();
    }
    const consumed = await this.dependencies.transaction.execute(async (repositories) => {
      const accepted = await repositories.exportJobs.consumeDownloadToken(
        job.id,
        requester.id,
        this.dependencies.tokens.hash(input.rawToken),
        at,
      );
      if (!accepted) return false;
      await repositories.auditEvents.append(
        buildReportExportAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'download_authorized',
          job,
          context: input.context,
          occurredAt: at,
        }),
      );
      return true;
    });
    if (!consumed) {
      await privateFile.stream.cancel().catch(() => undefined);
      throw new NotFoundError();
    }
    return {
      filename: job.filename,
      mimeType: job.mimeType,
      byteLength: privateFile.byteLength,
      stream: privateFile.stream,
    };
  }
}
