import type {
  NormalizedReportFilters,
  ReportPeriodType,
  ReportType,
} from '@/application/reporting/dto/report-dtos';

export const EXPORT_JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED'] as const;

export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];
export type ExportJobMode = 'SYNCHRONOUS' | 'QUEUED';
export type ExportFailureCode =
  | 'AUTHORIZATION_REVOKED'
  | 'DATABASE_UNAVAILABLE'
  | 'STORAGE_UNAVAILABLE'
  | 'GENERATION_TIMEOUT'
  | 'ROW_LIMIT_EXCEEDED'
  | 'FILE_LIMIT_EXCEEDED'
  | 'INVALID_CONFIGURATION'
  | 'GENERATION_FAILED';

export interface ExportJobDto {
  readonly publicId: string;
  readonly requesterPublicId: string;
  readonly reportType: ReportType;
  readonly periodType: ReportPeriodType;
  readonly filters: NormalizedReportFilters;
  readonly mode: ExportJobMode;
  readonly status: ExportJobStatus;
  readonly estimatedRows: number;
  readonly actualRows: number | null;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly filename: string | null;
  readonly mimeType: string | null;
  readonly byteLength: number | null;
  readonly sha256: string | null;
  readonly failureCode: ExportFailureCode | null;
  readonly failureMessage: string | null;
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly fileExpiresAt: string | null;
}

export interface ExportJobRecord extends ExportJobDto {
  readonly id: string;
  readonly requesterUserId: string;
  readonly storageKey: string | null;
  readonly filterHash: string;
  readonly availableAt: Date;
  readonly leaseOwner: string | null;
  readonly leaseExpiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toExportJobDto(job: ExportJobRecord): ExportJobDto {
  return {
    publicId: job.publicId,
    requesterPublicId: job.requesterPublicId,
    reportType: job.reportType,
    periodType: job.periodType,
    filters: job.filters,
    mode: job.mode,
    status: job.status,
    estimatedRows: job.estimatedRows,
    actualRows: job.actualRows,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    filename: job.filename,
    mimeType: job.mimeType,
    byteLength: job.byteLength,
    sha256: job.sha256,
    failureCode: job.failureCode,
    failureMessage: job.failureMessage,
    requestedAt: job.requestedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    fileExpiresAt: job.fileExpiresAt,
  };
}

export interface ExportDownloadTokenRecord {
  readonly id: string;
  readonly exportJobId: string;
  readonly userId: string;
  readonly tokenHash: Uint8Array;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export interface IssuedExportDownloadLink {
  readonly url: string;
  readonly expiresAt: string;
}
