import { afterEach, describe, expect, it } from 'vitest';

import {
  createAuditVerifierComposition,
  createAuditWebComposition,
  createAuditWorkerComposition,
} from '@/infrastructure/composition/audit';
import { createDatabaseClient } from '@/infrastructure/database/client';

const processEnvironment = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '1',
  DATABASE_NAME: 'fvdms',
  DATABASE_USER: 'fvdms_app',
  DATABASE_PASSWORD: 'app-password',
  DATABASE_POOL_MIN: '0',
  DATABASE_POOL_MAX: '1',
  DATABASE_CONNECT_TIMEOUT_MS: '50',
  DATABASE_QUERY_TIMEOUT_MS: '50',
  AUDIT_DATABASE_NAME: 'fvdms_audit',
  AUDIT_SINK_DATABASE_NAME: 'fvdms_audit_sink',
  AUDIT_WORKER_DATABASE_USER: 'fvdms_audit_worker',
  AUDIT_WORKER_DATABASE_PASSWORD: 'worker-password',
  AUDIT_SINK_HOST: '127.0.0.1',
  AUDIT_SINK_PORT: '1',
  AUDIT_SINK_DATABASE_USER: 'fvdms_audit_sink_writer',
  AUDIT_SINK_DATABASE_PASSWORD: 'sink-password',
  AUDIT_VERIFIER_DATABASE_USER: 'fvdms_audit_verifier',
  AUDIT_VERIFIER_DATABASE_PASSWORD: 'verifier-password',
};

const closeHooks: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closeHooks.splice(0).map((close) => close()));
});

describe('audit composition', () => {
  it('builds web reads from the application connection only', () => {
    const database = createDatabaseClient({
      host: '127.0.0.1',
      port: 1,
      name: 'fvdms',
      user: 'fvdms_app',
      password: 'app-password',
      poolMin: 0,
      poolMax: 1,
      connectTimeoutMs: 50,
      queryTimeoutMs: 50,
    });
    closeHooks.push(() => database.destroy());

    const composition = createAuditWebComposition(database, {
      primarySchema: 'fvdms_audit',
      maximumCanonicalPayloadBytes: 65_536,
    });

    expect(Object.isFrozen(composition)).toBe(true);
    expect(composition.searchAuditEvents.execute).toBeTypeOf('function');
    expect(composition.getAuditEvent.execute).toBeTypeOf('function');
    expect(composition.getLatestAuditVerification.execute).toBeTypeOf('function');
  });

  it('builds separate worker and verifier lifecycles from their process environments', async () => {
    const worker = createAuditWorkerComposition(processEnvironment);
    const verifier = createAuditVerifierComposition(processEnvironment);
    closeHooks.push(worker.close, verifier.close);

    expect(worker.chainWorker.runBatch).toBeTypeOf('function');
    expect(worker.sinkDeliveryWorker.runBatch).toBeTypeOf('function');
    expect(verifier.verifyAuditChain.execute).toBeTypeOf('function');
    expect(worker.close).not.toBe(verifier.close);
  });
});
