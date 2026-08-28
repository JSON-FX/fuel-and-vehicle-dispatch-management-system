import { describe, expect, it, vi } from 'vitest';

import type {
  AuditChainHeadDto,
  AuditOutboxRecordDto,
} from '@/application/audit/dto/audit-event-dtos';
import type {
  AuditChainRepository,
  LockedAuditChainRepository,
} from '@/application/audit/ports/audit-chain-repository';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';

const firstPublicId = '01900000-0000-7000-8000-000000000801';
const secondPublicId = '01900000-0000-7000-8000-000000000802';
const now = '2026-08-28T05:00:00.000Z';

function payload(publicId: string, action = 'auth.test.recorded'): string {
  return JSON.stringify({
    action,
    actorPublicId: null,
    after: null,
    before: null,
    entity: null,
    ipAddress: null,
    metadata: {},
    occurredAt: now,
    publicId,
    reasonCode: null,
    requestId: `request-${publicId.slice(-3)}`,
    schemaVersion: 1,
    userAgent: null,
  });
}

function outbox(
  sourcePosition: string,
  eventPublicId: string,
  canonicalPayload = payload(eventPublicId),
): AuditOutboxRecordDto {
  return { sourcePosition, eventPublicId, canonicalPayload, capturedAt: now };
}

class FakeChainRepository implements AuditChainRepository, LockedAuditChainRepository {
  head: AuditChainHeadDto = {
    sequence: '0',
    sourcePosition: '0',
    recordHash: new Uint8Array(32),
  };
  rows: readonly AuditOutboxRecordDto[] = [];
  committedRecords: Parameters<LockedAuditChainRepository['append']>[0] = [];
  appendCalls = 0;

  async executeWithLockedHead<T>(
    work: (repository: LockedAuditChainRepository) => Promise<T>,
  ): Promise<T> {
    const originalHead = this.head;
    const originalRecords = this.committedRecords;
    try {
      return await work(this);
    } catch (error) {
      this.head = originalHead;
      this.committedRecords = originalRecords;
      throw error;
    }
  }

  async getHead(): Promise<AuditChainHeadDto> {
    return this.head;
  }

  async loadOutboxAfter(
    sourcePosition: string,
    limit: number,
  ): Promise<readonly AuditOutboxRecordDto[]> {
    return this.rows
      .filter((row) => BigInt(row.sourcePosition) > BigInt(sourcePosition))
      .slice(0, limit);
  }

  async append(
    records: Parameters<LockedAuditChainRepository['append']>[0],
    nextHead: AuditChainHeadDto,
  ): Promise<void> {
    this.appendCalls += 1;
    this.committedRecords = records;
    this.head = nextHead;
  }

  async listPendingSinkDeliveries(): Promise<never[]> {
    return [];
  }

  async markSinkDelivered(): Promise<void> {}

  async scheduleSinkRetry(): Promise<void> {}
}

function worker(repository: AuditChainRepository, batchSize = 100): AuditChainWorker {
  return new AuditChainWorker({
    repository,
    canonicalizer: new Rfc8785AuditCanonicalizer(),
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => new Date(now) },
    policy: { batchSize, maximumCanonicalPayloadBytes: 65_536 },
  });
}

describe('AuditChainWorker', () => {
  it('returns idle without appending when no outbox event follows the locked head', async () => {
    const repository = new FakeChainRepository();

    await expect(worker(repository).runBatch()).resolves.toEqual({ status: 'IDLE' });
    expect(repository.appendCalls).toBe(0);
  });

  it('chains a bounded ordered batch from the locked head and advances it once', async () => {
    const repository = new FakeChainRepository();
    repository.rows = [outbox('1', firstPublicId), outbox('2', secondPublicId)];

    await expect(worker(repository, 2).runBatch()).resolves.toMatchObject({
      status: 'PROGRESSED',
      processedCount: 2,
      lastSequence: '2',
      lastSourcePosition: '2',
    });
    expect(repository.committedRecords.map((record) => record.sequence)).toEqual(['1', '2']);
    expect(repository.committedRecords[0]!.previousHash).toEqual(new Uint8Array(32));
    expect(repository.committedRecords[1]!.previousHash).toEqual(
      repository.committedRecords[0]!.recordHash,
    );
    expect(repository.head.recordHash).toEqual(repository.committedRecords[1]!.recordHash);
    expect(repository.appendCalls).toBe(1);
  });

  it('rolls back the whole batch and returns a safe halt result for a poison event', async () => {
    const repository = new FakeChainRepository();
    repository.rows = [
      outbox('1', firstPublicId),
      outbox('2', secondPublicId, `{ "publicId": "${secondPublicId}" }`),
    ];

    await expect(worker(repository).runBatch()).resolves.toEqual({
      status: 'HALTED',
      sourcePosition: '2',
      errorCode: 'NON_CANONICAL_AUDIT_PAYLOAD',
    });
    expect(repository.committedRecords).toEqual([]);
    expect(repository.head.sequence).toBe('0');
  });

  it('propagates repository failures rather than misclassifying them as poison events', async () => {
    const repository = new FakeChainRepository();
    vi.spyOn(repository, 'getHead').mockRejectedValue(new Error('database unavailable'));

    await expect(worker(repository).runBatch()).rejects.toThrow('database unavailable');
  });
});
