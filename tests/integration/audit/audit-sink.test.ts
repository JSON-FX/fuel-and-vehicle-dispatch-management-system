import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';

import type { AuditEventInput, AuditSinkRecordDto } from '@/application/audit/dto/audit-event-dtos';
import type { AuditSink } from '@/application/audit/ports/audit-sink';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { AuditSinkDeliveryWorker } from '@/application/audit/services/audit-sink-delivery-worker';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { KyselyAuditSink } from '@/infrastructure/database/audit/kysely-audit-sink';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { createTestDatabase } from '../helpers/test-database';
import {
  createAuditTestDatabase,
  resetAuditEvidence,
  type AuditTestDatabase,
} from '../helpers/audit-test-database';

let database: Kysely<Database>;
let restricted: AuditTestDatabase;
const at = new Date('2026-08-28T06:30:00.000Z');

const event: AuditEventInput = {
  publicId: '01900000-0000-7000-8000-000000000901',
  schemaVersion: 1,
  occurredAt: at.toISOString(),
  actorPublicId: null,
  action: 'auth.test.delivered',
  entity: null,
  requestId: 'sink-request-1',
  ipAddress: null,
  userAgent: null,
  reasonCode: null,
  before: null,
  after: null,
  metadata: {},
};

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

function delivery(sink: AuditSink): AuditSinkDeliveryWorker {
  return deliveryWith(chainRepository(), sink);
}

function deliveryWith(
  repository: KyselyAuditChainRepository,
  sink: AuditSink,
): AuditSinkDeliveryWorker {
  return new AuditSinkDeliveryWorker({
    repository,
    sink,
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => at },
    random: () => 0,
    policy: { batchSize: 100, retryBaseMs: 1_000, retryMaxMs: 60_000 },
  });
}

beforeAll(async () => {
  const configuration = inject('mysql');
  database = createTestDatabase(configuration);
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
  restricted = await createAuditTestDatabase(configuration);
});

beforeEach(async () => {
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

describe('append-only audit sink delivery', () => {
  it('delivers exact chain bytes and recognizes a lost-acknowledgement retry', async () => {
    await new KyselyAuthTransaction(database).execute(({ auditEvents }) =>
      auditEvents.append(event),
    );
    await expect(finalizer().runBatch()).resolves.toMatchObject({ status: 'PROGRESSED' });
    const sink = new KyselyAuditSink(database, { sinkSchema: 'fvdms_audit_sink' });

    await expect(delivery(sink).runBatch()).resolves.toEqual({
      status: 'PROCESSED',
      deliveredCount: 1,
      retryCount: 0,
    });
    await sql`update fvdms_audit.audit_sink_deliveries
              set delivered_at = null, delivery_fingerprint = null
              where sequence = 1`.execute(database);
    await expect(delivery(sink).runBatch()).resolves.toEqual({
      status: 'PROCESSED',
      deliveredCount: 1,
      retryCount: 0,
    });

    const rows = await sql<{
      canonical_payload: string;
      previous_hash: Buffer;
      record_hash: Buffer;
    }>`select canonical_payload, previous_hash, record_hash
       from fvdms_audit_sink.audit_sink_entries`.execute(database);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.canonical_payload).toContain('auth.test.delivered');
  });

  it('supports exact retry recovery through only the dedicated runtime accounts', async () => {
    await new KyselyAuthTransaction(restricted.application).execute(({ auditEvents }) =>
      auditEvents.append(event),
    );
    const repository = new KyselyAuditChainRepository(restricted.workerDatabase, {
      primarySchema: 'fvdms_audit',
    });
    await new AuditChainWorker({
      repository,
      canonicalizer: new Rfc8785AuditCanonicalizer(),
      hasher: new NodeSha256AuditHasher(),
      clock: { now: () => at },
      policy: { batchSize: 100, maximumCanonicalPayloadBytes: 65_536 },
    }).runBatch();
    const restrictedDelivery = deliveryWith(
      repository,
      new KyselyAuditSink(restricted.sinkWriterDatabase, {
        sinkSchema: 'fvdms_audit_sink',
      }),
    );

    await expect(restrictedDelivery.runBatch()).resolves.toMatchObject({ deliveredCount: 1 });
    await sql`update fvdms_audit.audit_sink_deliveries
              set delivered_at = null, delivery_fingerprint = null
              where sequence = 1`.execute(database);
    await expect(restrictedDelivery.runBatch()).resolves.toMatchObject({ deliveredCount: 1 });
    expect(
      (await sql`select * from fvdms_audit_sink.audit_sink_entries`.execute(database)).rows,
    ).toHaveLength(1);
  });

  it('leaves primary chaining intact and schedules retry when the sink is unavailable', async () => {
    await new KyselyAuthTransaction(database).execute(({ auditEvents }) =>
      auditEvents.append(event),
    );
    await finalizer().runBatch();
    const unavailable: AuditSink = { append: vi.fn().mockRejectedValue(new Error('offline')) };

    await expect(delivery(unavailable).runBatch()).resolves.toEqual({
      status: 'PROCESSED',
      deliveredCount: 0,
      retryCount: 1,
    });
    expect(
      (await sql`select * from fvdms_audit.audit_chain_entries`.execute(database)).rows,
    ).toHaveLength(1);
    const state = await sql<{
      attempt_count: number;
      last_error_code: string;
      delivered_at: Date | null;
    }>`select attempt_count, last_error_code, delivered_at
       from fvdms_audit.audit_sink_deliveries`.execute(database);
    expect(state.rows[0]).toMatchObject({
      attempt_count: 1,
      last_error_code: 'SINK_UNAVAILABLE',
      delivered_at: null,
    });

    await sql`update fvdms_audit.audit_sink_deliveries
              set next_retry_at = ${at} where sequence = 1`.execute(database);
    await expect(
      delivery(new KyselyAuditSink(database, { sinkSchema: 'fvdms_audit_sink' })).runBatch(),
    ).resolves.toEqual({
      status: 'PROCESSED',
      deliveredCount: 1,
      retryCount: 0,
    });
    expect(
      (await sql`select * from fvdms_audit_sink.audit_sink_entries`.execute(database)).rows,
    ).toHaveLength(1);
  });

  it('rejects a changed record that collides with an existing delivery fingerprint', async () => {
    const sink = new KyselyAuditSink(database, { sinkSchema: 'fvdms_audit_sink' });
    const original: AuditSinkRecordDto = {
      deliveryFingerprint: new Uint8Array(32).fill(7),
      sequence: '1',
      eventPublicId: event.publicId,
      canonicalPayload: JSON.stringify({ original: true }),
      previousHash: new Uint8Array(32),
      recordHash: new Uint8Array(32).fill(1),
      deliveredAt: at.toISOString(),
    };
    await expect(sink.append(original)).resolves.toBe('INSERTED');
    await expect(
      sink.append({ ...original, canonicalPayload: JSON.stringify({ original: false }) }),
    ).rejects.toThrow(/conflict/i);

    const rows = await sql<{ canonical_payload: string }>`
      select canonical_payload from fvdms_audit_sink.audit_sink_entries
    `.execute(database);
    expect(rows.rows).toEqual([{ canonical_payload: JSON.stringify({ original: true }) }]);
  });
});
