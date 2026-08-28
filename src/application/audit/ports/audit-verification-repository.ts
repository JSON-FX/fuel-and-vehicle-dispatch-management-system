import type {
  AuditSinkRecordDto,
  AuditSinkVerificationCursorDto,
  AuditVerificationChainRecordDto,
  AuditVerificationHighWaterMarkDto,
  CompletedAuditVerificationRunDto,
} from '@/application/audit/dto/audit-event-dtos';

export interface AuditVerificationRepository {
  readPrimaryHighWaterMark(): Promise<AuditVerificationHighWaterMarkDto>;
  readPrimaryPage(
    afterSequence: string,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditVerificationChainRecordDto[]>;
  readSinkPage(
    after: AuditSinkVerificationCursorDto | null,
    throughSequence: string,
    limit: number,
  ): Promise<readonly AuditSinkRecordDto[]>;
  appendCompletedRun(
    run: CompletedAuditVerificationRunDto,
    highWaterRecordHash: Uint8Array,
  ): Promise<void>;
}
