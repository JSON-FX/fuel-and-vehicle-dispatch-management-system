import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { resetAuditEvidence } from '../helpers/audit-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
const at = new Date('2026-08-28T05:30:00.000Z');

function event(index: number): AuditEventInput {
  const suffix = index.toString().padStart(12, '0');
  return {
    publicId: `01900000-0000-7000-8000-${suffix}`,
    schemaVersion: 1,
    occurredAt: at.toISOString(),
    actorPublicId: null,
    action: 'auth.test.recorded',
    entity: null,
    requestId: `chain-request-${index}`,
    ipAddress: null,
    userAgent: null,
    reasonCode: null,
    before: null,
    after: null,
    metadata: { index },
  };
}

function worker(batchSize = 100): AuditChainWorker {
  return new AuditChainWorker({
    repository: new KyselyAuditChainRepository(database, { primarySchema: 'fvdms_audit' }),
    canonicalizer: new Rfc8785AuditCanonicalizer(),
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => at },
    policy: { batchSize, maximumCanonicalPayloadBytes: 65_536 },
  });
}

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
});

beforeEach(async () => {
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
  await database.destroy();
});

describe('audit chain finalization', () => {
  it('finalizes deterministic bounded batches and initializes independent sink delivery', async () => {
    const transaction = new KyselyAuthTransaction(database);
    for (const index of [1, 2, 3]) {
      await transaction.execute(({ auditEvents }) => auditEvents.append(event(index)));
    }

    await expect(worker(2).runBatch()).resolves.toMatchObject({
      status: 'PROGRESSED',
      processedCount: 2,
      lastSequence: '2',
    });
    await expect(worker(2).runBatch()).resolves.toMatchObject({
      status: 'PROGRESSED',
      processedCount: 1,
      lastSequence: '3',
    });
    await expect(worker(2).runBatch()).resolves.toEqual({ status: 'IDLE' });

    const records = await sql<{
      sequence: string;
      source_position: string;
      previous_hash: Buffer;
      record_hash: Buffer;
      canonical_payload: string;
    }>`select sequence, source_position, previous_hash, record_hash, canonical_payload
       from fvdms_audit.audit_chain_entries order by sequence`.execute(database);
    expect(records.rows.map((row) => row.sequence)).toEqual(['1', '2', '3']);
    expect(records.rows[0]!.previous_hash).toEqual(Buffer.alloc(32));
    expect(records.rows[1]!.previous_hash).toEqual(records.rows[0]!.record_hash);
    expect(records.rows[2]!.previous_hash).toEqual(records.rows[1]!.record_hash);

    const head = await sql<{
      last_sequence: string;
      last_source_position: string;
      last_record_hash: Buffer;
    }>`select last_sequence, last_source_position, last_record_hash
       from fvdms_audit.audit_chain_heads where head_name = 'global'`.execute(database);
    expect(head.rows[0]).toMatchObject({
      last_sequence: '3',
      last_source_position: records.rows[2]!.source_position,
      last_record_hash: records.rows[2]!.record_hash,
    });
    expect(
      (await sql`select * from fvdms_audit.audit_sink_deliveries`.execute(database)).rows,
    ).toHaveLength(3);
  });

  it('rolls back every record in a batch and halts at the first poison event', async () => {
    const transaction = new KyselyAuthTransaction(database);
    await transaction.execute(({ auditEvents }) => auditEvents.append(event(11)));
    await transaction.execute(({ auditEvents }) => auditEvents.append(event(12)));
    await sql`update fvdms_audit.audit_outbox
              set canonical_payload = concat('{ ', substring(canonical_payload, 2))
              where request_id = 'chain-request-12'`.execute(database);

    const poison = await sql<{ source_position: string }>`
      select source_position from fvdms_audit.audit_outbox where request_id = 'chain-request-12'
    `.execute(database);
    await expect(worker().runBatch()).resolves.toEqual({
      status: 'HALTED',
      sourcePosition: poison.rows[0]!.source_position,
      errorCode: 'NON_CANONICAL_AUDIT_PAYLOAD',
    });
    expect(
      (await sql`select * from fvdms_audit.audit_chain_entries`.execute(database)).rows,
    ).toHaveLength(0);
    expect(
      (
        await sql<{ last_sequence: string }>`select last_sequence
          from fvdms_audit.audit_chain_heads where head_name = 'global'`.execute(database)
      ).rows[0]!.last_sequence,
    ).toBe('0');
  });

  it('serializes concurrent workers through the one global chain head', async () => {
    const transaction = new KyselyAuthTransaction(database);
    await transaction.execute(({ auditEvents }) => auditEvents.append(event(21)));
    await transaction.execute(({ auditEvents }) => auditEvents.append(event(22)));

    const results = await Promise.all([worker(1).runBatch(), worker(1).runBatch()]);
    expect(results).toEqual([
      expect.objectContaining({ status: 'PROGRESSED' }),
      expect.objectContaining({ status: 'PROGRESSED' }),
    ]);
    const records = await sql<{ sequence: string }>`
      select sequence from fvdms_audit.audit_chain_entries order by sequence
    `.execute(database);
    expect(records.rows.map((row) => row.sequence)).toEqual(['1', '2']);
  });

  it('releases the global head lock after a failed transaction and resumes on restart', async () => {
    await new KyselyAuthTransaction(database).execute(({ auditEvents }) =>
      auditEvents.append(event(31)),
    );
    const repository = new KyselyAuditChainRepository(database, {
      primarySchema: 'fvdms_audit',
    });

    await expect(
      repository.executeWithLockedHead(async (locked) => {
        await locked.getHead();
        throw new Error('simulated worker termination');
      }),
    ).rejects.toThrow('simulated worker termination');
    await expect(worker().runBatch()).resolves.toMatchObject({
      status: 'PROGRESSED',
      processedCount: 1,
      lastSequence: '1',
    });
  });
});
