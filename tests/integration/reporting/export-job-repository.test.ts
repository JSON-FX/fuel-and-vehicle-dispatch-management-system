import { createHash } from 'node:crypto';

import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';
import { KyselyExportJobRepository } from '@/infrastructure/database/reporting/kysely-export-job-repository';
import type { Database } from '@/infrastructure/database/types';

import {
  fuelActorPublicId,
  fuelPublicId,
  prepareFuelDatabase,
  resetFuelDatabase,
} from '../helpers/fuel-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;

const now = new Date('2026-08-29T01:00:00.000Z');
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
});

beforeEach(async () => {
  await database.deleteFrom('export_download_tokens').execute();
  await database.deleteFrom('export_jobs').execute();
  await resetFuelDatabase(database);
});

afterAll(async () => {
  await database.destroy();
});

async function actorId(): Promise<string> {
  return (await database.selectFrom('users').select('id').executeTakeFirstOrThrow()).id;
}

async function createJob(repository: KyselyExportJobRepository, suffix: number) {
  return repository.create({
    publicId: fuelPublicId(800 + suffix).toString(),
    requesterUserId: await actorId(),
    requesterPublicId: fuelActorPublicId.toString(),
    filters,
    filterHash: createHash('sha256').update(JSON.stringify(filters)).digest('hex'),
    mode: 'QUEUED',
    estimatedRows: 12,
    now,
  });
}

describe('export job repository', () => {
  it('creates, lists, and isolates jobs by opaque identifier and owner', async () => {
    const repository = new KyselyExportJobRepository(database);
    const job = await createJob(repository, 1);

    expect(job).toMatchObject({
      publicId: fuelPublicId(801).toString(),
      requesterPublicId: fuelActorPublicId.toString(),
      mode: 'QUEUED',
      status: 'QUEUED',
      estimatedRows: 12,
      attempts: 0,
      maxAttempts: 3,
    });
    await expect(repository.findOwn(job.publicId, job.requesterUserId)).resolves.toEqual(job);
    await expect(repository.findOwn(job.publicId, '999999')).resolves.toBeNull();
    await expect(repository.listOwn(job.requesterUserId, 10)).resolves.toEqual([job]);
  });

  it('allows only one concurrent worker to claim a queued job', async () => {
    const repository = new KyselyExportJobRepository(database);
    await createJob(repository, 2);
    const lease = new Date(now.valueOf() + 16 * 60_000);

    const [first, second] = await Promise.all([
      repository.claimNext('worker-a', now, lease),
      repository.claimNext('worker-b', now, lease),
    ]);
    const claimed = [first, second].filter((job) => job !== null);

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ status: 'RUNNING', attempts: 1 });
  });

  it('retries with compare-and-set state and completes with exact private metadata', async () => {
    const repository = new KyselyExportJobRepository(database);
    const created = await createJob(repository, 3);
    const lease = new Date(now.valueOf() + 16 * 60_000);
    const running = await repository.claimNext('worker-a', now, lease);
    expect(running?.id).toBe(created.id);

    const retryAt = new Date(now.valueOf() + 1_000);
    await repository.retry(created.id, 'worker-a', retryAt, now);
    await expect(repository.claimNext('worker-b', now, lease)).resolves.toBeNull();
    const reclaimed = await repository.claimNext('worker-b', retryAt, lease);
    expect(reclaimed).toMatchObject({ attempts: 2, status: 'RUNNING' });

    await repository.complete(created.id, 'worker-b', {
      actualRows: 12,
      storageKey: '01/report.xlsx',
      filename: 'fuel-issuance-20260829.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      byteLength: 4096,
      sha256: 'ab'.repeat(32),
      finishedAt: now,
      fileExpiresAt: new Date(now.valueOf() + 24 * 60 * 60_000),
    });

    await expect(
      repository.findOwn(created.publicId, created.requesterUserId),
    ).resolves.toMatchObject({
      status: 'COMPLETED',
      actualRows: 12,
      filename: 'fuel-issuance-20260829.xlsx',
      byteLength: 4096,
      sha256: 'ab'.repeat(32),
    });
  });

  it('consumes a hashed download token once and respects expiry', async () => {
    const repository = new KyselyExportJobRepository(database);
    const job = await createJob(repository, 4);
    const tokenHash = createHash('sha256').update('raw-token').digest();
    await repository.createDownloadToken({
      exportJobId: job.id,
      userId: job.requesterUserId,
      tokenHash,
      expiresAt: new Date(now.valueOf() + 5 * 60_000),
      consumedAt: null,
      createdAt: now,
    });

    await expect(
      repository.consumeDownloadToken(job.id, job.requesterUserId, tokenHash, now),
    ).resolves.toBe(true);
    await expect(
      repository.consumeDownloadToken(job.id, job.requesterUserId, tokenHash, now),
    ).resolves.toBe(false);

    const expiredHash = createHash('sha256').update('expired-token').digest();
    await repository.createDownloadToken({
      exportJobId: job.id,
      userId: job.requesterUserId,
      tokenHash: expiredHash,
      expiresAt: new Date(now.valueOf() - 1),
      consumedAt: null,
      createdAt: now,
    });
    await expect(
      repository.consumeDownloadToken(job.id, job.requesterUserId, expiredHash, now),
    ).resolves.toBe(false);
  });
});
