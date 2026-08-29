import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { KyselyAuthTransaction } from '@/infrastructure/database/auth/kysely-auth-transaction';
import { createMigrator } from '@/infrastructure/database/migrator';
import type { Database } from '@/infrastructure/database/types';

import { resetAuditEvidence } from '../helpers/audit-test-database';
import { createTestDatabase } from '../helpers/test-database';

let database: Kysely<Database>;
let transaction: KyselyAuthTransaction;

const event = (overrides: Partial<AuditEventInput> = {}): AuditEventInput => ({
  publicId: '01900000-0000-7000-8000-000000000601',
  schemaVersion: 1,
  occurredAt: '2026-08-28T03:00:00.000Z',
  actorPublicId: null,
  action: 'auth.user.created',
  entity: { type: 'user', publicId: '01900000-0000-7000-8000-000000000602' },
  requestId: 'request-601',
  ipAddress: '192.0.2.10',
  userAgent: 'Integration browser',
  reasonCode: null,
  before: null,
  after: { active: true },
  metadata: { roleCount: 1 },
  ...overrides,
});

beforeAll(async () => {
  database = createTestDatabase(inject('mysql'));
  expect((await createMigrator(database).migrateToLatest()).error).toBeUndefined();
  transaction = new KyselyAuthTransaction(database);
});

beforeEach(async () => {
  await sql`delete from fvdms_audit.audit_outbox`.execute(database);
  await sql`delete from export_download_tokens`.execute(database);
  await sql`delete from export_jobs`.execute(database);
  await sql`delete from vehicle_dispatch_conflict_overrides`.execute(database);
  await sql`delete from vehicle_dispatches`.execute(database);
  await sql`delete from fuel_ledger_entries`.execute(database);
  await sql`delete from fuel_issuances`.execute(database);
  await sql`delete from fuel_sequence_monthly`.execute(database);
  await sql`update dispatch_schedule_settings
    set policy = 'WARN_AND_ACK', updated_by_user_id = null, updated_at = '2026-08-29 00:00:00.000000'`.execute(
    database,
  );
  await sql`delete from budget_allocations`.execute(database);
  await sql`delete from vehicles`.execute(database);
  await sql`delete from drivers`.execute(database);
  await sql`delete from offices`.execute(database);
  await sql`delete from user_roles`.execute(database);
  await sql`delete from users`.execute(database);
});

afterAll(async () => {
  await resetAuditEvidence(database);
  await database.destroy();
});

describe('transactional audit outbox', () => {
  it('commits a business write and exact canonical event together', async () => {
    await transaction.execute(async ({ users, auditEvents }) => {
      await users.create({
        publicId: '01900000-0000-7000-8000-000000000602',
        username: 'outbox.user',
        email: 'outbox.user@example.lan',
        fullName: 'Outbox User',
        passwordHash: '$argon2id$test-only',
        mustChangePassword: true,
        createdAt: new Date('2026-08-28T03:00:00.000Z'),
      });
      await auditEvents.append(event());
    });

    const row = await sql<{
      source_position: string;
      event_public_id: Buffer;
      action: string;
      entity_type: string;
      ip_address: Buffer;
      canonical_payload: string;
    }>`
      select source_position, event_public_id, action, entity_type, ip_address, canonical_payload
      from fvdms_audit.audit_outbox
    `.execute(database);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0]).toMatchObject({
      action: 'auth.user.created',
      entity_type: 'user',
      ip_address: Buffer.from([192, 0, 2, 10]),
    });
    const canonical = row.rows[0]!.canonical_payload;
    expect(canonical).toBe(JSON.stringify(JSON.parse(canonical)));
    expect(JSON.parse(canonical)).toMatchObject({
      publicId: '01900000-0000-7000-8000-000000000601',
      schemaVersion: 1,
      action: 'auth.user.created',
    });
  });

  it('rolls back the business write when event validation fails', async () => {
    await expect(
      transaction.execute(async ({ users, auditEvents }) => {
        await users.create({
          publicId: '01900000-0000-7000-8000-000000000602',
          username: 'invalid.event',
          email: 'invalid.event@example.lan',
          fullName: 'Invalid Event',
          passwordHash: '$argon2id$test-only',
          mustChangePassword: true,
          createdAt: new Date('2026-08-28T03:00:00.000Z'),
        });
        await auditEvents.append(
          event({ metadata: { sessionToken: 'must-not-be-captured' } as never }),
        );
      }),
    ).rejects.toThrowError(/sensitive/i);

    expect(await database.selectFrom('users').selectAll().execute()).toHaveLength(0);
    expect((await sql`select * from fvdms_audit.audit_outbox`.execute(database)).rows).toHaveLength(
      0,
    );
  });

  it('rolls back a durable event when the business workflow later fails', async () => {
    await expect(
      transaction.execute(async ({ auditEvents }) => {
        await auditEvents.append(event());
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    expect((await sql`select * from fvdms_audit.audit_outbox`.execute(database)).rows).toHaveLength(
      0,
    );
  });
});
