import { createHash } from 'node:crypto';

import type { Clock } from '@/application/auth/ports/clock';
import type { ExportJobRecord } from '@/application/reporting/dto/export-job-dtos';
import type {
  NormalizedReportFilters,
  ReportRequestContext,
} from '@/application/reporting/dto/report-dtos';
import type { ExportJobRepository } from '@/application/reporting/ports/export-job-repository';
import type { ReportQueryRepository } from '@/application/reporting/ports/report-query-repository';
import type { ReportRequesterRepository } from '@/application/reporting/ports/report-requester-repository';
import type { ReportingTransaction } from '@/application/reporting/ports/reporting-transaction';
import { buildReportExportAuditEvent } from '@/application/reporting/services/report-audit-events';
import type { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import {
  AuthorizationError,
  BusinessRuleError,
} from '@/application/shared/errors/application-error';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';

export interface ExportJobExecutionService {
  execute(job: ExportJobRecord, workerId: string | null): Promise<ExportJobRecord>;
}

export class RequestReportExport {
  constructor(
    private readonly dependencies: {
      readonly queries: ReportQueryRepository;
      readonly exportJobs: ExportJobRepository;
      readonly transaction: ReportingTransaction;
      readonly requesters: ReportRequesterRepository;
      readonly permissions: ReportPermissionPolicy;
      readonly publicIds: PublicIdGenerator;
      readonly clock: Clock;
      readonly executor: ExportJobExecutionService;
      readonly synchronousRowLimit?: number;
      readonly maximumRows?: number;
    },
  ) {}

  async execute(input: {
    readonly context: ReportRequestContext;
    readonly filters: NormalizedReportFilters;
  }): Promise<{ readonly httpStatus: 201 | 202; readonly job: ExportJobRecord }> {
    this.dependencies.permissions.assertCanExport(
      input.context.principal,
      input.filters.reportType,
    );
    const requester = await this.dependencies.requesters.findByPublicId(
      input.context.principal.userPublicId,
    );
    if (requester === null || !requester.isActive || requester.deletedAt !== null) {
      throw new AuthorizationError();
    }

    const maximumRows = this.dependencies.maximumRows ?? 100_000;
    const estimatedRows = await this.dependencies.queries.estimateRows(input.filters, maximumRows);
    if (estimatedRows > maximumRows) {
      throw new BusinessRuleError('The report exceeds the 100,000-row export limit.');
    }

    const synchronous =
      input.filters.periodType !== 'ANNUAL' &&
      estimatedRows <= (this.dependencies.synchronousRowLimit ?? 1_000);
    const mode = synchronous ? 'SYNCHRONOUS' : 'QUEUED';
    const at = this.dependencies.clock.now();
    const publicId = this.dependencies.publicIds.generate().toString();
    const filterHash = createHash('sha256')
      .update(JSON.stringify(input.filters), 'utf8')
      .digest('hex');

    const created = await this.dependencies.transaction.execute(async (repositories) => {
      const createdJob = await repositories.exportJobs.create({
        publicId,
        requesterUserId: requester.id,
        requesterPublicId: requester.principal.userPublicId,
        filters: input.filters,
        filterHash,
        mode,
        estimatedRows,
        now: at,
      });
      await repositories.auditEvents.append(
        buildReportExportAuditEvent({
          publicId: this.dependencies.publicIds.generate().toString(),
          action: 'requested',
          job: createdJob,
          context: input.context,
          occurredAt: at,
        }),
      );
      return createdJob;
    });

    if (!synchronous) return { httpStatus: 202, job: created };
    const running = await this.dependencies.exportJobs.start(created.id, null, at, null);
    const completed = await this.dependencies.executor.execute(running, null);
    return { httpStatus: 201, job: completed };
  }
}
