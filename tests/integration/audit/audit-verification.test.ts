import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { AuditVerificationRepository } from '@/application/audit/ports/audit-verification-repository';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { VerifyAuditChain } from '@/application/audit/services/verify-audit-chain';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { KyselyAuditSink } from '@/infrastructure/database/audit/kysely-audit-sink';
import { KyselyAuditVerificationRepository } from '@/infrastructure/database/audit/kysely-audit-verification-repository';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { createTestDatabase } from '../helpers/test-database';
import {
  createAuditTestDatabase,
  resetAuditEvidence,
  type AuditTestDatabase,
} from '../helpers/audit-test-database';

let database: Kysely<Database>;
let restricted: AuditTestDatabase;
const at = new Date('2026-08-28T07:30:00.000Z');

function event(index: number): AuditEventInput {
  return {
    publicId: `01900000-0000-7000-8000-${index.toString().padStart(12, '0')}`,
    schemaVersion: 1,
    occurredAt: at.toISOString(),
    actorPublicId: null,
    action: 'audit.test.verified',
    entity: null,
    requestId: `verification-request-${index}`,
    ipAddress: null,
    userAgent: null,
    reasonCode: null,
    before: null,
    after: null,
    metadata: { index },
  };
}

function chainRepository(): KyselyAuditChainRepository {
  return new KyselyAuditChainRepository(database, { primarySchema: 'fvdms_audit' });
}

function finalizer(): AuditChainWorker {
  return new AuditChainWorker({
    repository: chainRepository(),
    canonicalizer: new Rfc8785AuditCanonicalizer(),
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => at },
    policy: { batchSize: 100, maximumCanonicalPayloadBytes: 65_536 },
  });
}

function delivery(): AuditSinkDeliveryWorker {
  return new AuditSinkDeliveryWorker({
    repository: chainRepository(),
    sink: new KyselyAuditSink(database, { sinkSchema: 'fvdms_audit_sink' }),
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => at },
    random: () => 0,
    policy: { batchSize: 100, retryBaseMs: 1_000, retryMaxMs: 60_000 },
  });
}

function repository(): KyselyAuditVerificationRepository {
  return new KyselyAuditVerificationRepository(
    restricted.verifierPrimaryDatabase,
    restricted.verifierSinkDatabase,
    {
      primarySchema: 'fvdms_audit',
      sinkSchema: 'fvdms_audit_sink',
    },
  );
}

function verifier(target: AuditVerificationRepository = repository()): VerifyAuditChain {
  return new VerifyAuditChain({
    repository: target,
    hasher: new NodeSha256AuditHasher(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => at },
    pageSize: 1,
  });
}

async function captureAndDeliver(...indexes: number[]): Promise<void> {
  const transaction = new KyselyAuthTransaction(database);
  for (const index of indexes) {
    await transaction.execute(({ auditEvents }) => auditEvents.append(event(index)));
  }
  await finalizer().runBatch();
  await delivery().runBatch();
}

beforeAll(async () => {
  const configuration = inject('mysql');
  database = createTestDatabase(configuration);
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
  restricted = await createAuditTestDatabase(configuration);
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_verification_runs`.execute(database);
  await sql`delete from fvdms_audit_sink.audit_sink_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_sink_deliveries`.execute(database);
  await sql`delete from fvdms_audit.audit_chain_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`update fvdms_audit.audit_chain_heads
            set last_sequence = 0, last_source_position = 0,
                last_record_hash = ${Buffer.alloc(32)}, updated_at = ${at}
            where head_name = 'global'`.execute(database);
});

afterAll(async () => {
  await resetAuditEvidence(database, at);
  await restricted.close();
  await database.destroy();
});

describe('bounded audit-chain verification', () => {
  it('persists one completed pass for exact primary and sink records', async () => {
    await captureAndDeliver(1, 2);

    await expect(verifier().execute()).resolves.toMatchObject({
      status: 'PASS',
      highWaterSequence: '2',
      verifiedCount: '2',
    });
    const runs = await sql<{ status: string; high_water_sequence: string }>`
      select status, high_water_sequence from fvdms_audit.audit_verification_runs
    `.execute(database);
    expect(runs.rows).toEqual([{ status: 'PASS', high_water_sequence: '2' }]);
  });

  it('detects missing, changed, duplicate, and captured-head evidence', async () => {
    await captureAndDeliver(11, 12);
    await sql`delete from fvdms_audit_sink.audit_sink_entries where sequence = 1`.execute(database);
    await expect(verifier().execute()).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: 'MISSING_SINK',
    });

    await sql`update fvdms_audit.audit_sink_deliveries
              set delivered_at = null, delivery_fingerprint = null, next_retry_at = ${at}
              where sequence = 1`.execute(database);
    await delivery().runBatch();
    await sql`update fvdms_audit_sink.audit_sink_entries
              set canonical_payload = '{"changed":true}' where sequence = 1`.execute(database);
    await expect(verifier().execute()).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: 'CHANGED_PAYLOAD',
    });

    await sql`update fvdms_audit_sink.audit_sink_entries as sink
              join fvdms_audit.audit_chain_entries as chain on chain.sequence = sink.sequence
              set sink.canonical_payload = chain.canonical_payload
              where sink.sequence = 1`.execute(database);
    await sql`insert into fvdms_audit_sink.audit_sink_entries
              select unhex(repeat('aa', 32)), sequence, event_public_id, canonical_payload,
                     previous_hash, record_hash, delivered_at
              from fvdms_audit_sink.audit_sink_entries where sequence = 1`.execute(database);
    await expect(verifier().execute()).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: 'DUPLICATE_SINK',
    });

    await sql`delete from fvdms_audit_sink.audit_sink_entries
              where delivery_fingerprint = unhex(repeat('aa', 32))`.execute(database);
    await sql`update fvdms_audit.audit_chain_heads
              set last_record_hash = ${Buffer.alloc(32, 9)} where head_name = 'global'`.execute(
      database,
    );
    await expect(verifier().execute()).resolves.toMatchObject({ status: 'FAIL' });
  });

  it('ignores records finalized above the captured high-water mark', async () => {
    await captureAndDeliver(21);
    const base = repository();
    let appended = false;
    const concurrent: AuditVerificationRepository = {
      readPrimaryHighWaterMark: () => base.readPrimaryHighWaterMark(),
      readPrimaryPage: async (...arguments_) => {
        if (!appended) {
          appended = true;
          await captureAndDeliver(22);
        }
        return base.readPrimaryPage(...arguments_);
      },
      readSinkPage: (...arguments_) => base.readSinkPage(...arguments_),
      appendCompletedRun: (...arguments_) => base.appendCompletedRun(...arguments_),
    };

    await expect(verifier(concurrent).execute()).resolves.toMatchObject({
      status: 'PASS',
      highWaterSequence: '1',
      verifiedCount: '1',
    });
  });

  it.each([
    [
      'MISSING_PRIMARY',
      async () => {
        await sql`delete from fvdms_audit_sink.audit_sink_entries where sequence = 1`.execute(
          database,
        );
        await sql`delete from fvdms_audit.audit_sink_deliveries where sequence = 1`.execute(
          database,
        );
        await sql`delete from fvdms_audit.audit_chain_entries where sequence = 1`.execute(database);
      },
    ],
    [
      'MISSING_SINK',
      async () => {
        await sql`delete from fvdms_audit_sink.audit_sink_entries where sequence = 1`.execute(
          database,
        );
      },
    ],
    [
      'EXTRA_SINK',
      async () => {
        await sql`delete from fvdms_audit.audit_sink_deliveries where sequence = 1`.execute(
          database,
        );
        await sql`delete from fvdms_audit.audit_chain_entries where sequence = 1`.execute(database);
      },
    ],
    [
      'DUPLICATE_SINK',
      async () => {
        await sql`insert into fvdms_audit_sink.audit_sink_entries
                  select unhex(repeat('ab', 32)), sequence, event_public_id, canonical_payload,
                         previous_hash, record_hash, delivered_at
                  from fvdms_audit_sink.audit_sink_entries where sequence = 1`.execute(database);
      },
    ],
    [
      'CHANGED_PAYLOAD',
      async () => {
        await sql`update fvdms_audit_sink.audit_sink_entries
                  set canonical_payload = '{"changed":true}' where sequence = 1`.execute(database);
      },
    ],
    [
      'PREVIOUS_HASH_MISMATCH',
      async () => {
        await sql`update fvdms_audit.audit_chain_entries
                  set previous_hash = ${Buffer.alloc(32, 7)} where sequence = 2`.execute(database);
      },
    ],
    [
      'RECORD_HASH_MISMATCH',
      async () => {
        await sql`update fvdms_audit.audit_chain_entries
                  set record_hash = ${Buffer.alloc(32, 7)} where sequence = 1`.execute(database);
      },
    ],
    [
      'REORDERED_SEQUENCE',
      async () => {
        await sql`update fvdms_audit.audit_chain_entries set source_position = 999 where sequence = 1`.execute(
          database,
        );
        await sql`update fvdms_audit.audit_chain_entries set source_position = 1 where sequence = 2`.execute(
          database,
        );
        await sql`update fvdms_audit.audit_chain_entries set source_position = 2 where sequence = 1`.execute(
          database,
        );
      },
    ],
    [
      'EVENT_ID_MISMATCH',
      async () => {
        await sql`update fvdms_audit_sink.audit_sink_entries
                  set event_public_id = unhex(replace('01900000-0000-7000-8000-000000009999', '-', ''))
                  where sequence = 1`.execute(database);
      },
    ],
    [
      'CAPTURED_HEAD_MISMATCH',
      async () => {
        await sql`update fvdms_audit.audit_chain_heads
                  set last_record_hash = ${Buffer.alloc(32, 7)} where head_name = 'global'`.execute(
          database,
        );
      },
    ],
  ])('detects %s through a real restricted verifier connection', async (expected, tamper) => {
    await captureAndDeliver(31, 32);
    await tamper();

    await expect(verifier().execute()).resolves.toMatchObject({
      status: 'FAIL',
      firstMismatchType: expected,
    });
  });
});
