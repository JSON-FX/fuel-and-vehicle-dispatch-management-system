import type { AuditChainRepository } from '@/application/audit/ports/audit-chain-repository';
import type { AuditHasher } from '@/application/audit/ports/audit-hasher';
import type { AuditSink } from '@/application/audit/ports/audit-sink';
import type { Clock } from '@/application/auth/ports/clock';

export type AuditSinkDeliveryWorkerResult =
  | { readonly status: 'IDLE' }
  | {
      readonly status: 'PROCESSED';
      readonly deliveredCount: number;
      readonly retryCount: number;
    };

export class AuditSinkDeliveryWorker {
  constructor(
    private readonly dependencies: {
      readonly repository: AuditChainRepository;
      readonly sink: AuditSink;
      readonly hasher: AuditHasher;
      readonly clock: Clock;
      readonly random: () => number;
      readonly policy: {
        readonly batchSize: number;
        readonly retryBaseMs: number;
        readonly retryMaxMs: number;
      };
    },
  ) {}

  async runBatch(): Promise<AuditSinkDeliveryWorkerResult> {
    const startedAt = this.dependencies.clock.now();
    const pending = await this.dependencies.repository.listPendingSinkDeliveries(
      startedAt.toISOString(),
      this.dependencies.policy.batchSize,
    );
    if (pending.length === 0) return { status: 'IDLE' };

    let deliveredCount = 0;
    let retryCount = 0;
    for (const record of pending) {
      const canonicalPayload = new TextEncoder().encode(record.canonicalPayload);
      const deliveryFingerprint = this.dependencies.hasher.hashDelivery({
        sequence: record.sequence,
        eventPublicId: record.eventPublicId,
        canonicalPayload,
        previousHash: record.previousHash,
        recordHash: record.recordHash,
      });
      const deliveredAt = this.dependencies.clock.now().toISOString();

      try {
        await this.dependencies.sink.append({
          deliveryFingerprint,
          sequence: record.sequence,
          eventPublicId: record.eventPublicId,
          canonicalPayload: record.canonicalPayload,
          previousHash: record.previousHash,
          recordHash: record.recordHash,
          deliveredAt,
        });
        await this.dependencies.repository.markSinkDelivered(
          record.sequence,
          deliveryFingerprint,
          deliveredAt,
        );
        deliveredCount += 1;
      } catch {
        const attemptCount = record.attemptCount + 1;
        const delay = retryDelay(
          attemptCount,
          this.dependencies.policy.retryBaseMs,
          this.dependencies.policy.retryMaxMs,
          this.dependencies.random(),
        );
        await this.dependencies.repository.scheduleSinkRetry({
          sequence: record.sequence,
          attemptCount,
          nextRetryAt: new Date(startedAt.getTime() + delay).toISOString(),
          errorCode: 'SINK_UNAVAILABLE',
        });
        retryCount += 1;
      }
    }

    return { status: 'PROCESSED', deliveredCount, retryCount };
  }
}

function retryDelay(
  attemptCount: number,
  baseMs: number,
  maximumMs: number,
  random: number,
): number {
  const exponent = Math.min(Math.max(attemptCount - 1, 0), 52);
  const exponential = Math.min(maximumMs, baseMs * 2 ** exponent);
  const jitter = 1 + Math.min(Math.max(random, 0), 1) * 0.1;
  return Math.min(maximumMs, Math.round(exponential * jitter));
}
