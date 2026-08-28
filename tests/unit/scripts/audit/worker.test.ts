import { describe, expect, it, vi } from 'vitest';

import { runAuditWorker } from '@/../scripts/audit/worker';

describe('audit worker process loop', () => {
  it('runs finalization before delivery and waits only when both are idle', async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const chainWorker = {
      runBatch: vi
        .fn()
        .mockImplementationOnce(async () => {
          calls.push('chain-progress');
          return {
            status: 'PROGRESSED' as const,
            processedCount: 2,
            lastSequence: '2',
            lastSourcePosition: '2',
          };
        })
        .mockImplementationOnce(async () => {
          calls.push('chain-idle');
          return { status: 'IDLE' as const };
        }),
    };
    const sinkDeliveryWorker = {
      runBatch: vi
        .fn()
        .mockImplementationOnce(async () => {
          calls.push('sink-progress');
          return { status: 'PROCESSED' as const, deliveredCount: 2, retryCount: 0 };
        })
        .mockImplementationOnce(async () => {
          calls.push('sink-idle');
          return { status: 'IDLE' as const };
        }),
    };
    const wait = vi.fn(async () => controller.abort());

    const result = await runAuditWorker({
      chainWorker,
      sinkDeliveryWorker,
      pollIntervalMs: 1_000,
      signal: controller.signal,
      wait,
      log: vi.fn(),
    });

    expect(result).toEqual({ status: 'STOPPED' });
    expect(calls).toEqual(['chain-progress', 'sink-progress', 'chain-idle', 'sink-idle']);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(1_000, controller.signal);
  });

  it('halts without delivering past a poison audit event', async () => {
    const sinkDeliveryWorker = { runBatch: vi.fn() };
    const log = vi.fn();

    const result = await runAuditWorker({
      chainWorker: {
        runBatch: vi.fn(async () => ({
          status: 'HALTED' as const,
          sourcePosition: '17',
          errorCode: 'NON_CANONICAL_AUDIT_PAYLOAD',
        })),
      },
      sinkDeliveryWorker,
      pollIntervalMs: 1_000,
      signal: new AbortController().signal,
      wait: vi.fn(),
      log,
    });

    expect(result).toEqual({
      status: 'HALTED',
      sourcePosition: '17',
      errorCode: 'NON_CANONICAL_AUDIT_PAYLOAD',
    });
    expect(sinkDeliveryWorker.runBatch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('audit.worker.halted', {
      sourcePosition: '17',
      errorCode: 'NON_CANONICAL_AUDIT_PAYLOAD',
    });
  });
});
