import { createHash } from 'node:crypto';
import { promises as fileSystem } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';
import {
  ExportJobExecutor,
  ExportJobWorker,
} from '@/application/reporting/services/export-job-worker';
import { ReportPermissionPolicy } from '@/application/reporting/services/report-permission-policy';
import { KyselyExportJobRepository } from '@/infrastructure/database/reporting/kysely-export-job-repository';
import { KyselyReportQueryRepository } from '@/infrastructure/database/reporting/kysely-report-query-repository';
import { KyselyReportRequesterRepository } from '@/infrastructure/database/reporting/kysely-report-requester-repository';
import { KyselyReportingTransaction } from '@/infrastructure/database/reporting/kysely-reporting-transaction';
import type { Database } from '@/infrastructure/database/types';
import { ExcelJsReportExporter } from '@/infrastructure/reporting/exceljs-report-exporter';
import { LocalPrivateExportStorage } from '@/infrastructure/reporting/local-private-export-storage';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import {
  fuelActorPublicId,
  fuelPublicId,
  prepareFuelDatabase,
  resetFuelDatabase,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let storageRoot: string;
const now = new Date('2026-08-29T04:00:00.000Z');
const filters: NormalizedReportFilters = {
  reportType: 'FUEL_ISSUANCE',
  requestingOfficePublicId: null,
  periodType: 'MONTHLY',
  referenceDate: '2026-08-29',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: null,
  cursor: null,
  pageSize: 100,
};

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  await prepareFuelDatabase(database);
  storageRoot = await fileSystem.mkdtemp(path.join(tmpdir(), 'fvdms-worker-export-'));
});

beforeEach(async () => {
  for (const entry of await fileSystem.readdir(storageRoot)) {
    await fileSystem.rm(path.join(storageRoot, entry), { recursive: true });
  }
  await resetFuelDatabase(database);
  const [actor, role] = await Promise.all([
    database.selectFrom('users').select('id').executeTakeFirstOrThrow(),
    database
      .selectFrom('roles')
      .select('id')
      .where('code', '=', 'PSMD_STAFF')
      .executeTakeFirstOrThrow(),
  ]);
  await database
    .insertInto('user_roles')
    .values({ user_id: actor.id, role_id: role.id, assigned_by_user_id: null, created_at: now })
    .execute();
});

afterAll(async () => {
  await database.destroy();
  await fileSystem.rm(storageRoot, { recursive: true });
});

async function createQueuedJob(repository: KyselyExportJobRepository, suffix: number) {
  const actor = await database.selectFrom('users').select('id').executeTakeFirstOrThrow();
  return repository.create({
    publicId: fuelPublicId(930 + suffix).toString(),
    requesterUserId: actor.id,
    requesterPublicId: fuelActorPublicId.toString(),
    filters,
    filterHash: createHash('sha256').update(JSON.stringify(filters)).digest('hex'),
    mode: 'QUEUED',
    estimatedRows: 0,
    now,
  });
}

function worker() {
  const exportJobs = new KyselyExportJobRepository(database);
  const storage = new LocalPrivateExportStorage(storageRoot);
  const executor = new ExportJobExecutor({
    exportJobs,
    transaction: new KyselyReportingTransaction(database),
    queries: new KyselyReportQueryRepository(database),
    requesters: new KyselyReportRequesterRepository(database),
    permissions: new ReportPermissionPolicy(),
    exporter: new ExcelJsReportExporter(),
    storage,
    publicIds: new UuidV7Generator(),
    clock: { now: () => now },
  });
  return {
    exportJobs,
    storage,
    worker: new ExportJobWorker({
      exportJobs,
      executor,
      storage,
      clock: { now: () => now },
    }),
  };
}

describe('report export worker', () => {
  it('claims one job, streams a private workbook, and commits completion audit evidence', async () => {
    const setup = worker();
    const created = await createQueuedJob(setup.exportJobs, 1);

    await expect(setup.worker.runOnce('worker-a')).resolves.toBe(true);
    const completed = await setup.exportJobs.findOwn(created.publicId, created.requesterUserId);
    expect(completed).toMatchObject({
      status: 'COMPLETED',
      attempts: 1,
      actualRows: 0,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(completed?.storageKey).not.toBeNull();
    await expect(setup.storage.open(completed!.storageKey!)).resolves.toMatchObject({
      byteLength: expect.any(Number),
    });

    const actions = await database
      .withSchema('fvdms_audit')
      .selectFrom('audit_outbox')
      .select('action')
      .where('action', '=', 'report.export.completed')
      .execute();
    expect(actions).toHaveLength(1);
  });

  it('fails queued work safely when requester permission is revoked', async () => {
    const setup = worker();
    const created = await createQueuedJob(setup.exportJobs, 2);
    await database.deleteFrom('user_roles').execute();

    await expect(setup.worker.runOnce('worker-b')).resolves.toBe(true);
    await expect(
      setup.exportJobs.findOwn(created.publicId, created.requesterUserId),
    ).resolves.toMatchObject({
      status: 'FAILED',
      attempts: 1,
      failureCode: 'AUTHORIZATION_REVOKED',
    });
    await expect(fileSystem.readdir(storageRoot)).resolves.toEqual([]);
  });

  it('finalizes an expired third-attempt lease as failed with audit evidence', async () => {
    const setup = worker();
    const created = await createQueuedJob(setup.exportJobs, 4);
    await database
      .updateTable('export_jobs')
      .set({
        status: 'RUNNING',
        attempts: 3,
        lease_owner: 'interrupted-worker',
        lease_expires_at: new Date(now.valueOf() - 1),
        started_at: now,
      })
      .where('id', '=', created.id)
      .execute();

    await expect(setup.worker.runOnce('recovery-worker')).resolves.toBe(true);
    await expect(
      setup.exportJobs.findOwn(created.publicId, created.requesterUserId),
    ).resolves.toMatchObject({
      status: 'FAILED',
      attempts: 3,
      failureCode: 'GENERATION_FAILED',
    });
    const actions = await database
      .withSchema('fvdms_audit')
      .selectFrom('audit_outbox')
      .select('action')
      .where('action', '=', 'report.export.failed')
      .execute();
    expect(actions).toHaveLength(1);
  });

  it('expires completed files and removes stale temporary files in bounded cleanup', async () => {
    const setup = worker();
    const created = await createQueuedJob(setup.exportJobs, 3);
    await setup.worker.runOnce('worker-c');
    await database
      .updateTable('export_jobs')
      .set({ file_expires_at: new Date(now.valueOf() - 1) })
      .where('id', '=', created.id)
      .execute();

    await expect(setup.worker.runCleanup()).resolves.toMatchObject({ expiredFiles: 1 });
    await expect(
      setup.exportJobs.findOwn(created.publicId, created.requesterUserId),
    ).resolves.toMatchObject({ status: 'EXPIRED', storageKey: null });
    await expect(fileSystem.readdir(storageRoot)).resolves.toEqual([]);
  });
});
