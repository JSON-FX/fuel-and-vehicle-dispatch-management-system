import type { AuditCanonicalizer } from '@/application/audit/ports/audit-canonicalizer';
import type { AuditChainRepository } from '@/application/audit/ports/audit-chain-repository';
import type { AuditHasher } from '@/application/audit/ports/audit-hasher';
import type { Clock } from '@/application/auth/ports/clock';
import { AuditChainRecord } from '@/domain/audit/entities/audit-chain-record';
import { AuditEvent } from '@/domain/audit/entities/audit-event';
import { DomainError } from '@/domain/shared/errors/domain-error';

export type AuditChainWorkerResult =
  | { readonly status: 'IDLE' }
  | {
      readonly status: 'PROGRESSED';
      readonly processedCount: number;
      readonly lastSequence: string;
      readonly lastSourcePosition: string;
    }
  | {
      readonly status: 'HALTED';
      readonly sourcePosition: string;
      readonly errorCode: string;
    };

class PoisonAuditEventError extends Error {
  constructor(
    readonly sourcePosition: string,
    readonly errorCode: string,
  ) {
    super(`Audit finalization halted at source position ${sourcePosition}.`);
    this.name = 'PoisonAuditEventError';
  }
}

export class AuditChainWorker {
  constructor(
    private readonly dependencies: {
      readonly repository: AuditChainRepository;
      readonly canonicalizer: AuditCanonicalizer;
      readonly hasher: AuditHasher;
      readonly clock: Clock;
      readonly policy: {
        readonly batchSize: number;
        readonly maximumCanonicalPayloadBytes: number;
      };
    },
  ) {}

  async runBatch(): Promise<AuditChainWorkerResult> {
    try {
      return await this.dependencies.repository.executeWithLockedHead(async (repository) => {
        const head = await repository.getHead();
        const outbox = await repository.loadOutboxAfter(
          head.sourcePosition,
          this.dependencies.policy.batchSize,
        );
        if (outbox.length === 0) return { status: 'IDLE' };

        const chainedAt = this.dependencies.clock.now().toISOString();
        const records: AuditChainRecord[] = [];
        let previousHash = head.recordHash;
        let sequence = BigInt(head.sequence);

        for (const source of outbox) {
          try {
            const canonicalBytes = this.dependencies.canonicalizer.validateCanonicalText(
              source.canonicalPayload,
              this.dependencies.policy.maximumCanonicalPayloadBytes,
            );
            const event = AuditEvent.create(
              JSON.parse(source.canonicalPayload) as Parameters<typeof AuditEvent.create>[0],
            ).toPrimitives();
            if (event.publicId !== source.eventPublicId) {
              throw new DomainError(
                'AUDIT_EVENT_ID_MISMATCH',
                'The outbox event identity does not match its canonical payload.',
              );
            }

            sequence += BigInt(1);
            const nextSequence = sequence.toString();
            const recordHash = this.dependencies.hasher.hashRecord({
              formatVersion: 1,
              sequence: nextSequence,
              previousHash,
              canonicalPayload: canonicalBytes,
            });
            const record = AuditChainRecord.create({
              sequence: nextSequence,
              sourcePosition: source.sourcePosition,
              sourceEventPublicId: source.eventPublicId,
              canonicalPayload: source.canonicalPayload,
              previousHash,
              recordHash,
              chainedAt,
            });
            records.push(record);
            previousHash = record.recordHash;
          } catch (error) {
            if (error instanceof DomainError) {
              throw new PoisonAuditEventError(source.sourcePosition, error.code);
            }
            throw error;
          }
        }

        const last = records.at(-1)!;
        await repository.append(records, {
          sequence: last.sequence,
          sourcePosition: last.sourcePosition,
          recordHash: last.recordHash,
        });
        return {
          status: 'PROGRESSED',
          processedCount: records.length,
          lastSequence: last.sequence,
          lastSourcePosition: last.sourcePosition,
        };
      });
    } catch (error) {
      if (error instanceof PoisonAuditEventError) {
        return {
          status: 'HALTED',
          sourcePosition: error.sourcePosition,
          errorCode: error.errorCode,
        };
      }
      throw error;
    }
  }
}
