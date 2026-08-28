import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput, AuditSearchQuery } from '@/application/audit/dto/audit-event-dtos';
import { AuditChainWorker } from '@/application/audit/services/audit-chain-worker';
import { GetAuditEvent } from '@/application/audit/use-cases/get-audit-event';
import { SearchAuditEvents } from '@/application/audit/use-cases/search-audit-events';
import { NodeSha256AuditHasher } from '@/infrastructure/audit/node-sha256-audit-hasher';
import { Rfc8785AuditCanonicalizer } from '@/infrastructure/audit/rfc8785-audit-canonicalizer';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { KyselyAuditChainRepository } from '@/infrastructure/database/audit/kysely-audit-chain-repository';
import { KyselyAuditReadTransaction } from '@/infrastructure/database/audit/kysely-audit-read-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';
import { UuidV7Generator } from '@/infrastructure/identifiers/uuid-v7-generator';

import { resetAuditEvidence } from '../helpers/audit-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
const actorPublicId = '01900000-0000-7000-8000-000000001201';
const entityPublicId = '01900000-0000-7000-8000-000000001202';
const events: readonly AuditEventInput[] = [
  {
    publicId: '01900000-0000-7000-8000-000000001211',
    schemaVersion: 1,
    occurredAt: '2026-08-28T08:00:00.000Z',
    actorPublicId,
    action: 'auth.login.failed',
    entity: { type: 'user', publicId: entityPublicId },
    requestId: 'query-request-one',
    ipAddress: '192.0.2.30',
    userAgent: 'Query integration browser',
    reasonCode: 'invalid_credentials',
    before: { active: true },
    after: null,
    metadata: { failureCount: 1 },
  },
  {
    publicId: '01900000-0000-7000-8000-000000001212',
    schemaVersion: 1,
    occurredAt: '2026-08-28T09:00:00.000Z',
    actorPublicId,
    action: 'auth.login.succeeded',
    entity: null,
    requestId: 'query-request-two',
    ipAddress: null,
    userAgent: null,
    reasonCode: null,
    before: null,
    after: null,
    metadata: {},
  },
  {
    publicId: '01900000-0000-7000-8000-000000001213',
    schemaVersion: 1,
    occurredAt: '2026-08-28T10:00:00.000Z',
    actorPublicId,
    action: 'auth.user.updated',
    entity: { type: 'user', publicId: entityPublicId },
    requestId: 'query-request-three',
    ipAddress: null,
    userAgent: null,
    reasonCode: 'profile_changed',
    before: null,
    after: { active: false },
    metadata: { changedFields: 1 },
  },
];

const baseQuery: AuditSearchQuery = {
  from: null,
  to: null,
  action: null,
  entityType: null,
  entityPublicId: null,
  actorPublicId: null,
  requestId: null,
  cursor: null,
  pageSize: 50,
};

const principal = (sensitive: boolean) =>
  ({
    userPublicId: actorPublicId,
    permissions: sensitive ? ['audit.read', 'audit.read_sensitive'] : ['audit.read'],
  }) as never;

function readTransaction(): KyselyAuditReadTransaction {
  return new KyselyAuditReadTransaction(database, {
    primarySchema: 'fvdms_audit',
    maximumCanonicalPayloadBytes: 65_536,
  });
}

function search(): SearchAuditEvents {
  return new SearchAuditEvents({
    transaction: readTransaction(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => new Date('2026-08-28T10:30:00.000Z') },
  });
}

function detail(): GetAuditEvent {
  return new GetAuditEvent({
    transaction: readTransaction(),
    publicIds: new UuidV7Generator(),
    clock: { now: () => new Date('2026-08-28T10:31:00.000Z') },
  });
}

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_verification_runs`.execute(database);
  await sql`delete from fvdms_audit_sink.audit_sink_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_sink_deliveries`.execute(database);
  await sql`delete from fvdms_audit.audit_chain_entries`.execute(database);
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`update fvdms_audit.audit_chain_heads
            set last_sequence = 0, last_source_position = 0,
                last_record_hash = ${Buffer.alloc(32)}, updated_at = ${new Date('2026-08-28T08:00:00.000Z')}
            where head_name = 'global'`.execute(database);
  const transaction = new KyselyAuthTransaction(database);
  for (const event of events) {
    await transaction.execute(({ auditEvents }) => auditEvents.append(event));
  }
  await new AuditChainWorker({
    repository: new KyselyAuditChainRepository(database, { primarySchema: 'fvdms_audit' }),
    canonicalizer: new Rfc8785AuditCanonicalizer(),
    hasher: new NodeSha256AuditHasher(),
    clock: { now: () => new Date('2026-08-28T10:15:00.000Z') },
    policy: { batchSize: 100, maximumCanonicalPayloadBytes: 65_536 },
  }).runBatch();
});

afterAll(async () => {
  await resetAuditEvidence(database);
  await database.destroy();
});

describe('transactional audit queries', () => {
  it('binds combined structured filters and atomically records one safe search access', async () => {
    const result = await search().execute({
      actor: principal(false),
      requestId: 'search-access-request',
      ipAddress: '192.0.2.40',
      userAgent: 'Auditor browser',
      query: {
        ...baseQuery,
        from: '2026-08-28T07:00:00.000Z',
        to: '2026-08-28T08:30:00.000Z',
        action: 'auth.login.failed',
        entityType: 'user',
        entityPublicId,
        actorPublicId,
        requestId: 'query-request-one',
      },
    });

    expect(result.items.map((item) => item.publicId)).toEqual([events[0]!.publicId]);
    const access = await sql<{ canonical_payload: string }>`
      select canonical_payload from fvdms_audit.audit_outbox where action = 'audit.accessed'
    `.execute(database);
    expect(access.rows).toHaveLength(1);
    expect(JSON.parse(access.rows[0]!.canonical_payload).metadata).toEqual({
      accessType: 'search',
      filterCategories: [
        'from',
        'to',
        'action',
        'entityType',
        'entityPublicId',
        'actorPublicId',
        'requestId',
      ],
      returnedCount: 1,
    });
  });

  it('navigates opaque newest-first cursors and rejects filter reuse', async () => {
    const first = await search().execute({
      actor: principal(false),
      requestId: 'cursor-one',
      ipAddress: null,
      userAgent: null,
      query: { ...baseQuery, pageSize: 1 },
    });
    expect(first.items[0]!.sequence).toBe('3');
    expect(first.nextCursor).not.toBeNull();

    const second = await search().execute({
      actor: principal(false),
      requestId: 'cursor-two',
      ipAddress: null,
      userAgent: null,
      query: { ...baseQuery, pageSize: 1, cursor: first.nextCursor },
    });
    expect(second.items[0]!.sequence).toBe('2');
    expect(second.previousCursor).not.toBeNull();

    const previous = await search().execute({
      actor: principal(false),
      requestId: 'cursor-three',
      ipAddress: null,
      userAgent: null,
      query: { ...baseQuery, pageSize: 1, cursor: second.previousCursor },
    });
    expect(previous.items[0]!.sequence).toBe('3');

    await expect(
      search().execute({
        actor: principal(false),
        requestId: 'cursor-invalid',
        ipAddress: null,
        userAgent: null,
        query: {
          ...baseQuery,
          pageSize: 1,
          cursor: first.nextCursor,
          action: 'auth.login.failed',
        },
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('redacts detail context without permission and audits only existing reads', async () => {
    const sensitive = await detail().execute({
      actor: principal(true),
      eventPublicId: events[0]!.publicId,
      requestId: 'detail-sensitive',
      ipAddress: null,
      userAgent: null,
    });
    expect(sensitive.sensitive).toEqual({
      ipAddress: '192.0.2.30',
      userAgent: 'Query integration browser',
      before: { active: true },
      after: null,
      metadata: { failureCount: 1 },
    });
    const redacted = await detail().execute({
      actor: principal(false),
      eventPublicId: events[0]!.publicId,
      requestId: 'detail-redacted',
      ipAddress: null,
      userAgent: null,
    });
    expect(redacted.sensitive).toBeNull();

    await expect(
      detail().execute({
        actor: principal(true),
        eventPublicId: '01900000-0000-7000-8000-000000001299',
        requestId: 'detail-missing',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
    const accessCount = await sql<{ count: string }>`
      select count(*) as count from fvdms_audit.audit_outbox where action = 'audit.accessed'
    `.execute(database);
    expect(accessCount.rows[0]!.count).toBe('2');
  });
});
