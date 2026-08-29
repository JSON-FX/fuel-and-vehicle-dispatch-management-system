import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type {
  ExportFailureCode,
  ExportJobRecord,
} from '@/application/reporting/dto/export-job-dtos';
import type { ReportRequestContext } from '@/application/reporting/dto/report-dtos';
import { AuditEvent } from '@/domain/audit/entities/audit-event';

export type ReportExportAuditAction = 'requested' | 'completed' | 'failed' | 'download_authorized';

export function buildReportExportAuditEvent(input: {
  readonly publicId: string;
  readonly action: ReportExportAuditAction;
  readonly job: ExportJobRecord;
  readonly context: ReportRequestContext;
  readonly occurredAt: Date;
  readonly failureCode?: ExportFailureCode;
}): AuditEventInput {
  return AuditEvent.create({
    publicId: input.publicId,
    schemaVersion: 1,
    occurredAt: input.occurredAt.toISOString(),
    actorPublicId: input.context.principal.userPublicId,
    action: `report.export.${input.action}`,
    entity: { type: 'report_export', publicId: input.job.publicId },
    requestId: input.context.requestId,
    ipAddress: input.context.ipAddress,
    userAgent: input.context.userAgent,
    reasonCode: input.failureCode ?? null,
    before: null,
    after: {
      reportType: input.job.reportType,
      periodType: input.job.periodType,
      mode: input.job.mode,
      status: input.action === 'requested' ? 'QUEUED' : input.job.status,
      estimatedRows: input.job.estimatedRows,
      actualRows: input.job.actualRows,
      attempts: input.job.attempts,
      fileExpiresAt: input.job.fileExpiresAt,
    },
    metadata: {
      filterHash: input.job.filterHash,
      startDate: input.job.filters.startDate,
      endDate: input.job.filters.endDate,
    },
  }).toPrimitives();
}
