import { pathToFileURL } from 'node:url';

import type { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import type { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { createAuditWorkerComposition } from '@/infrastructure/composition/audit';
import { parseAuditWorkerEnvironment } from '@/infrastructure/config/environment';
import { createPinoLogger } from '@/infrastructure/logging/pino-logger';

type AuditWorkerLog = (event: string, context: Readonly<Record<string, unknown>>) => void;

export type AuditWorkerLoopResult =
  | { readonly status: 'STOPPED' }
  | {
      readonly status: 'HALTED';
      readonly sourcePosition: string;
      readonly errorCode: string;
    };

export async function runAuditWorker(input: {
  readonly chainWorker: Pick<AuditChainWorker, 'runBatch'>;
  readonly sinkDeliveryWorker: Pick<AuditSinkDeliveryWorker, 'runBatch'>;
  readonly pollIntervalMs: number;
  readonly signal: AbortSignal;
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  readonly log: AuditWorkerLog;
}): Promise<AuditWorkerLoopResult> {
  const wait = input.wait ?? waitForPoll;
  while (!input.signal.aborted) {
    const chain = await input.chainWorker.runBatch();
    if (chain.status === 'HALTED') {
      const result = {
        status: 'HALTED' as const,
        sourcePosition: chain.sourcePosition,
        errorCode: chain.errorCode,
      };
      input.log('audit.worker.halted', {
        sourcePosition: result.sourcePosition,
        errorCode: result.errorCode,
      });
      return result;
    }
    if (chain.status === 'PROGRESSED') {
      input.log('audit.worker.chain.progressed', {
        processedCount: chain.processedCount,
        lastSequence: chain.lastSequence,
        lastSourcePosition: chain.lastSourcePosition,
      });
    }

    const sink = await input.sinkDeliveryWorker.runBatch();
    if (sink.status === 'PROCESSED') {
      input.log('audit.worker.sink.processed', {
        deliveredCount: sink.deliveredCount,
        retryCount: sink.retryCount,
      });
    }
    if (chain.status === 'IDLE' && sink.status === 'IDLE') {
      await wait(input.pollIntervalMs, input.signal);
    }
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
  const configuration = parseAuditWorkerEnvironment(process.env);
  const logger = createPinoLogger({ level: configuration.logLevel }).child({
    process: 'audit-worker',
  });
  const composition = createAuditWorkerComposition();
  try {
    logger.info('audit.worker.started');
    const result = await runAuditWorker({
      ...composition,
      signal: shutdown.signal,
      log: (event, context) => logger.info(event, context),
    });
    if (result.status === 'HALTED') return 1;
    logger.info('audit.worker.stopped');
    return 0;
  } catch {
    logger.warn('audit.worker.failed', { errorCode: 'AUDIT_WORKER_FAILURE' });
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
