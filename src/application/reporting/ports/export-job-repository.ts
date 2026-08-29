import type {
  ExportDownloadTokenRecord,
  ExportFailureCode,
  ExportJobMode,
  ExportJobRecord,
} from '@/application/reporting/dto/export-job-dtos';
import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';

export interface CreateExportJobInput {
  readonly publicId: string;
  readonly requesterUserId: string;
  readonly requesterPublicId: string;
  readonly filters: NormalizedReportFilters;
  readonly filterHash: string;
  readonly mode: ExportJobMode;
  readonly estimatedRows: number;
  readonly now: Date;
}

export interface CompleteExportJobInput {
  readonly actualRows: number;
  readonly storageKey: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly byteLength: number;
  readonly sha256: string;
  readonly finishedAt: Date;
  readonly fileExpiresAt: Date;
}

export interface FailExportJobInput {
  readonly failureCode: ExportFailureCode;
  readonly failureMessage: string;
  readonly failedAt: Date;
}

export interface ExportJobRepository {
  create(input: CreateExportJobInput): Promise<ExportJobRecord>;
  findOwn(publicId: string, requesterUserId: string): Promise<ExportJobRecord | null>;
  listOwn(requesterUserId: string, limit: number): Promise<readonly ExportJobRecord[]>;
  start(
    id: string,
    workerId: string | null,
    now: Date,
    leaseExpiresAt: Date | null,
  ): Promise<ExportJobRecord>;
  claimNext(workerId: string, now: Date, leaseExpiresAt: Date): Promise<ExportJobRecord | null>;
  renewLease(id: string, workerId: string, leaseExpiresAt: Date): Promise<boolean>;
  complete(id: string, workerId: string | null, input: CompleteExportJobInput): Promise<void>;
  retry(id: string, workerId: string, availableAt: Date, now: Date): Promise<void>;
  fail(id: string, workerId: string | null, input: FailExportJobInput): Promise<void>;
  expireCompleted(now: Date, limit: number): Promise<readonly ExportJobRecord[]>;
  markExpired(id: string, now: Date): Promise<void>;
  createDownloadToken(input: Omit<ExportDownloadTokenRecord, 'id'>): Promise<void>;
  consumeDownloadToken(
    jobId: string,
    userId: string,
    tokenHash: Uint8Array,
    now: Date,
  ): Promise<boolean>;
  deleteExpiredDownloadTokens(now: Date, limit: number): Promise<number>;
}
