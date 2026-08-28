import type { AuditSinkRecordDto } from '@/application/audit/dto/audit-event-dtos';

export type AuditSinkAppendResult = 'INSERTED' | 'EXACT_DUPLICATE';

export interface AuditSink {
  append(record: AuditSinkRecordDto): Promise<AuditSinkAppendResult>;
}
