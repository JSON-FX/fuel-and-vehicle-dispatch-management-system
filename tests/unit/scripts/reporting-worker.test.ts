import { describe, expect, it, vi } from 'vitest';

import { runReportingWorker } from '../../../scripts/reporting/worker';

describe('reporting worker loop', () => {
  it('processes one job at a time, runs cleanup, and stops through its signal', async () => {
    const shutdown = new AbortController();
    const runOnce = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const runCleanup = vi.fn().mockResolvedValue({
      expiredFiles: 1,
      expiredTokens: 2,
      temporaryFiles: 3,
    });
    const wait = vi.fn(async () => shutdown.abort());
    const log = vi.fn();

    await expect(
      runReportingWorker({
        worker: { runOnce, runCleanup },
        workerId: 'worker-test',
        pollIntervalMs: 1,
        cleanupEveryCycles: 1,
        signal: shutdown.signal,
        wait,
        log,
      }),
    ).resolves.toEqual({ status: 'STOPPED' });
    expect(runOnce).toHaveBeenCalledTimes(2);
    expect(runCleanup).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('reporting.worker.cleanup', {
      expiredFiles: 1,
      expiredTokens: 2,
      temporaryFiles: 3,
    });
  });
});
