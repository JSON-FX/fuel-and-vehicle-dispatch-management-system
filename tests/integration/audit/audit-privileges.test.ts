import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import {
  createAuditTestDatabase,
  resetAuditEvidence,
  type AuditTestDatabase,
} from '../helpers/audit-test-database';
import { createTestDatabase } from '../helpers/test-database';

let owner: Kysely<Database>;
let restricted: AuditTestDatabase;
const at = new Date('2026-08-28T11:00:00.000Z');
const event: AuditEventInput = {
  publicId: '01900000-0000-7000-8000-000000001701',
  schemaVersion: 1,
  occurredAt: at.toISOString(),
  actorPublicId: null,
  action: 'audit.privilege.tested',
  entity: null,
  requestId: 'privilege-request-1',
  ipAddress: null,
  userAgent: null,
  reasonCode: null,
  before: null,
  after: null,
  metadata: { restricted: true },
};

beforeAll(async () => {
  const configuration = inject('mysql');
  owner = createTestDatabase(configuration);
  expect((await createMigrator(owner).migrateToLatest()).error).toBeUndefined();
  restricted = await createAuditTestDatabase(configuration);
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_verification_runs`.execute(owner);
  await sql`delete from fvdms_audit_sink.audit_sink_entries`.execute(owner);
  await sql`delete from fvdms_audit.audit_sink_deliveries`.execute(owner);
  await sql`delete from fvdms_audit.audit_chain_entries`.execute(owner);
  await sql`delete from fvdms_audit.audit_outbox`.execute(owner);
  await sql`update fvdms_audit.audit_chain_heads
            set last_sequence = 0, last_source_position = 0,
                last_record_hash = ${Buffer.alloc(32)}, updated_at = ${at}
            where head_name = 'global'`.execute(owner);
});

afterAll(async () => {
  await resetAuditEvidence(owner, at);
  await restricted.close();
  await owner.destroy();
});

describe('audit database least privileges', () => {
  it('lets the application append but never rewrite or delete audit evidence', async () => {
    await new KyselyAuthTransaction(restricted.application).execute(({ auditEvents }) =>
      auditEvents.append(event),
    );

    expect((await sql`select * from fvdms_audit.audit_outbox`.execute(owner)).rows).toHaveLength(1);
    await expect(
      restricted.applicationRaw.query(
        "update fvdms_audit.audit_outbox set action = 'audit.changed' where source_position = 1",
      ),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.applicationRaw.query(
        'delete from fvdms_audit.audit_outbox where source_position = 1',
      ),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.applicationRaw.query('select * from fvdms_audit_sink.audit_sink_entries'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
  });

  it('limits the worker to primary finalization and delivery-state operations', async () => {
    await new KyselyAuthTransaction(restricted.application).execute(({ auditEvents }) =>
      auditEvents.append(event),
    );
    await expect(
      restricted.worker.query('select canonical_payload from fvdms_audit.audit_outbox'),
    ).resolves.toBeDefined();
    await expect(
      restricted.worker.query(
        "update fvdms_audit.audit_outbox set action = 'audit.changed' where source_position = 1",
      ),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.worker.query('delete from fvdms_audit.audit_chain_entries where sequence = 1'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.worker.query('insert into fvdms_audit_sink.audit_sink_entries values ()'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
  });

  it('keeps sink writer and verifier accounts unable to repair evidence', async () => {
    await expect(
      restricted.sinkWriter.query('select * from fvdms_audit_sink.audit_sink_entries'),
    ).resolves.toBeDefined();
    await expect(
      restricted.sinkWriter.query('delete from fvdms_audit_sink.audit_sink_entries'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.sinkWriter.query('select * from fvdms_audit.audit_chain_entries'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.verifier.query(
        "update fvdms_audit.audit_chain_heads set last_sequence = 99 where head_name = 'global'",
      ),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
    await expect(
      restricted.verifier.query('delete from fvdms_audit_sink.audit_sink_entries'),
    ).rejects.toMatchObject({ code: 'ER_TABLEACCESS_DENIED_ERROR' });
  });
});
