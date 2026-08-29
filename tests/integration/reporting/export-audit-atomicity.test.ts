import { createHash } from 'node:crypto';

import type { Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';
import { KyselyReportingTransaction } from '@/infrastructure/database/reporting/kysely-reporting-transaction';
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

function event(jobPublicId: string): AuditEventInput {
  return {
    publicId: fuelPublicId(890).toString(),
    schemaVersion: 1,
    occurredAt: now.toISOString(),
    actorPublicId: fuelActorPublicId.toString(),
    action: 'report.export.requested',
    entity: { type: 'report_export', publicId: jobPublicId },
    requestId: 'reporting-atomicity',
    ipAddress: '127.0.0.1',
    userAgent: 'Vitest',
    reasonCode: null,
    before: null,
    after: null,
    metadata: { reportType: 'FUEL_ISSUANCE' },
  };
}

describe('reporting transaction audit atomicity', () => {
  it('rolls back the export job when its audit append fails', async () => {
    const actor = await database.selectFrom('users').select('id').executeTakeFirstOrThrow();
    const transaction = new KyselyReportingTransaction(database);
    const jobPublicId = fuelPublicId(891).toString();

    await expect(
      transaction.execute(async ({ exportJobs, auditEvents }) => {
        await exportJobs.create({
          publicId: jobPublicId,
          requesterUserId: actor.id,
          requesterPublicId: fuelActorPublicId.toString(),
          filters,
          filterHash: createHash('sha256').update(JSON.stringify(filters)).digest('hex'),
          mode: 'QUEUED',
          estimatedRows: 1,
          now,
        });
        await auditEvents.append(event(jobPublicId));
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(database.selectFrom('export_jobs').select('id').execute()).resolves.toEqual([]);
    await expect(
      database
        .withSchema('fvdms_audit')
        .selectFrom('audit_outbox')
        .select('source_position')
        .execute(),
    ).resolves.toEqual([]);
  });

  it('commits the job and audit evidence together', async () => {
    const actor = await database.selectFrom('users').select('id').executeTakeFirstOrThrow();
    const transaction = new KyselyReportingTransaction(database);
    const jobPublicId = fuelPublicId(892).toString();

    await transaction.execute(async ({ exportJobs, auditEvents }) => {
      await exportJobs.create({
        publicId: jobPublicId,
        requesterUserId: actor.id,
        requesterPublicId: fuelActorPublicId.toString(),
        filters,
        filterHash: createHash('sha256').update(JSON.stringify(filters)).digest('hex'),
        mode: 'QUEUED',
        estimatedRows: 1,
        now,
      });
      await auditEvents.append(event(jobPublicId));
    });

    await expect(database.selectFrom('export_jobs').select('id').execute()).resolves.toHaveLength(
      1,
    );
    await expect(
      database
        .withSchema('fvdms_audit')
        .selectFrom('audit_outbox')
        .select('source_position')
        .execute(),
    ).resolves.toHaveLength(1);
  });
});
