import type {
  AuditChainHeadDto,
  AuditOutboxRecordDto,
  AuditPendingSinkDeliveryDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditChainRecord } from '@/domain/audit/entities/audit-chain-record';

export interface LockedAuditChainRepository {
  getHead(): Promise<AuditChainHeadDto>;
  loadOutboxAfter(sourcePosition: string, limit: number): Promise<readonly AuditOutboxRecordDto[]>;
  append(records: readonly AuditChainRecord[], nextHead: AuditChainHeadDto): Promise<void>;
}

export interface AuditSinkRetryInput {
  readonly sequence: string;
  readonly attemptCount: number;
  readonly nextRetryAt: string;
  readonly errorCode: string;
}

export interface AuditChainRepository {
  executeWithLockedHead<T>(
    work: (repository: LockedAuditChainRepository) => Promise<T>,
  ): Promise<T>;
  listPendingSinkDeliveries(
    now: string,
    limit: number,
  ): Promise<readonly AuditPendingSinkDeliveryDto[]>;
  markSinkDelivered(
    sequence: string,
    deliveryFingerprint: Uint8Array,
    deliveredAt: string,
  ): Promise<void>;
  scheduleSinkRetry(input: AuditSinkRetryInput): Promise<void>;
}
