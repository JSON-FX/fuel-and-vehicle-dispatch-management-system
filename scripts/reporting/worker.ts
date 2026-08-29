import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import type { ExportJobWorker } from '@/application/reporting/services/export-job-worker';
import { createReportingWorkerComposition } from '@/infrastructure/composition/reporting';
import { parseReportingWorkerEnvironment } from '@/infrastructure/config/environment';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';

type ReportingWorkerLog = (event: string, context: Readonly<Record<string, unknown>>) => void;

export async function runReportingWorker(input: {
  readonly worker: Pick<ExportJobWorker, 'runOnce' | 'runCleanup'>;
  readonly workerId: string;
  readonly pollIntervalMs: number;
  readonly cleanupEveryCycles?: number;
  readonly signal: AbortSignal;
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly log: ReportingWorkerLog;
}): Promise<{ readonly status: 'STOPPED' }> {
  const wait = input.wait ?? waitForPoll;
  const cleanupEveryCycles = input.cleanupEveryCycles ?? 60;
  let cycle = 0;
  while (!input.signal.aborted) {
    const processed = await input.worker.runOnce(input.workerId);
    cycle += 1;
    if (cycle % cleanupEveryCycles === 0) {
      const cleanup = await input.worker.runCleanup();
      if (cleanup.expiredFiles + cleanup.expiredTokens + cleanup.temporaryFiles > 0) {
        input.log('reporting.worker.cleanup', cleanup);
      }
    }
    if (processed) {
      input.log('reporting.worker.job.processed', {});
      continue;
    }
    await wait(input.pollIntervalMs, input.signal);
  }
  return { status: 'STOPPED' };
}

export async function waitForPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener('abort', done, { once: true });

    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
  });
}

async function main(): Promise<number> {
  const shutdown = new AbortController();
  const stop = () => shutdown.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const configuration = parseReportingWorkerEnvironment(process.env);
  const logger = createPinoLogger({ level: configuration.logLevel }).child({
    process: 'reporting-worker',
  });
  const composition = createReportingWorkerComposition();
  try {
    logger.info('reporting.worker.started');
    await runReportingWorker({
      ...composition,
      workerId: randomUUID(),
      signal: shutdown.signal,
      log: (event, context) => logger.info(event, context),
    });
    logger.info('reporting.worker.stopped');
    return 0;
  } catch {
    logger.warn('reporting.worker.failed', { errorCode: 'REPORTING_WORKER_FAILURE' });
    return 2;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await composition.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
