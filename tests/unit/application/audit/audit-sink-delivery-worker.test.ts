import { describe, expect, it, vi } from 'vitest';

import type { AuditPendingSinkDeliveryDto } from '@/application/audit/dto/audit-event-dtos';
import type {
  AuditChainRepository,
  AuditSinkRetryInput,
} from '@/application/audit/ports/audit-chain-repository';
import type { AuditSink } from '@/application/audit/ports/audit-sink';
import { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';

const now = new Date('2026-08-28T06:00:00.000Z');

function pending(sequence: string, attemptCount = 0): AuditPendingSinkDeliveryDto {
  return {
    sequence,
    eventPublicId: `01900000-0000-7000-8000-${sequence.padStart(12, '0')}`,
    canonicalPayload: JSON.stringify({ sequence }),
    previousHash: new Uint8Array(32),
    recordHash: new Uint8Array(32).fill(Number(sequence)),
    attemptCount,
  };
}

function repository(rows: readonly AuditPendingSinkDeliveryDto[]) {
  const marked: Array<{ sequence: string; fingerprint: Uint8Array; deliveredAt: string }> = [];
  const retries: AuditSinkRetryInput[] = [];
  const value: AuditChainRepository = {
    executeWithLockedHead: vi.fn(),
    listPendingSinkDeliveries: vi.fn().mockResolvedValue(rows),
    markSinkDelivered: vi.fn().mockImplementation((sequence, fingerprint, deliveredAt) => {
      marked.push({ sequence, fingerprint, deliveredAt });
    }),
    scheduleSinkRetry: vi.fn().mockImplementation((input) => {
      retries.push(input);
    }),
  };
  return { value, marked, retries };
}

function worker(input: {
  readonly repository: AuditChainRepository;
  readonly sink: AuditSink;
  readonly random?: () => number;
  readonly retryBaseMs?: number;
  readonly retryMaxMs?: number;
}): AuditSinkDeliveryWorker {
  return new AuditSinkDeliveryWorker({
    repository: input.repository,
    sink: input.sink,
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => now },
    random: input.random ?? (() => 0),
    policy: {
      batchSize: 100,
      retryBaseMs: input.retryBaseMs ?? 1_000,
      retryMaxMs: input.retryMaxMs ?? 60_000,
    },
  });
}

describe('AuditSinkDeliveryWorker', () => {
  it('returns idle when no due delivery exists', async () => {
    const state = repository([]);
    const sink: AuditSink = { append: vi.fn() };

    await expect(worker({ repository: state.value, sink }).runBatch()).resolves.toEqual({
      status: 'IDLE',
    });
    expect(sink.append).not.toHaveBeenCalled();
  });

  it('marks inserted and verified exact-duplicate records as delivered', async () => {
    const state = repository([pending('1'), pending('2')]);
    const sink: AuditSink = {
      append: vi.fn().mockResolvedValueOnce('INSERTED').mockResolvedValueOnce('EXACT_DUPLICATE'),
    };

    await expect(worker({ repository: state.value, sink }).runBatch()).resolves.toEqual({
      status: 'PROCESSED',
      deliveredCount: 2,
      retryCount: 0,
    });
    expect(state.marked.map(({ sequence }) => sequence)).toEqual(['1', '2']);
    expect(state.marked[0]!.fingerprint).toHaveLength(32);
    expect(state.retries).toEqual([]);
  });

  it('schedules a safe bounded exponential retry without exposing the sink error', async () => {
    const state = repository([pending('7', 3)]);
    const sink: AuditSink = { append: vi.fn().mockRejectedValue(new Error('password leaked')) };

    await expect(
      worker({ repository: state.value, sink, random: () => 0.5 }).runBatch(),
    ).resolves.toEqual({ status: 'PROCESSED', deliveredCount: 0, retryCount: 1 });
    expect(state.marked).toEqual([]);
    expect(state.retries).toEqual([
      {
        sequence: '7',
        attemptCount: 4,
        nextRetryAt: '2026-08-28T06:00:08.400Z',
        errorCode: 'SINK_UNAVAILABLE',
      },
    ]);
  });

  it('caps retry delay at the configured maximum', async () => {
    const state = repository([pending('8', 20)]);
    const sink: AuditSink = { append: vi.fn().mockRejectedValue(new Error('offline')) };

    await worker({
      repository: state.value,
      sink,
      random: () => 1,
      retryBaseMs: 1_000,
      retryMaxMs: 60_000,
    }).runBatch();

    expect(state.retries[0]!.nextRetryAt).toBe('2026-08-28T06:01:00.000Z');
  });
});
