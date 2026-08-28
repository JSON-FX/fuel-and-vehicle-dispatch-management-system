import { describe, expect, it, vi } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import { KyselyAuditOutboxStore } from '@/infrastructure/database/audit/kysely-audit-outbox-store';

const event: AuditEventInput = {
  publicId: '01900000-0000-7000-8000-000000000501',
  schemaVersion: 1,
  occurredAt: '2026-08-28T02:00:00.000Z',
  actorPublicId: '01900000-0000-7000-8000-000000000502',
  action: 'auth.user.updated',
  entity: { type: 'user', publicId: '01900000-0000-7000-8000-000000000503' },
  requestId: 'request-501',
  ipAddress: '2001:db8::1',
  userAgent: 'Test browser',
  reasonCode: 'profile_changed',
  before: { active: true },
  after: { active: false },
  metadata: { changedFields: 1 },
};

describe('KyselyAuditOutboxStore', () => {
  it('uses the supplied transaction handle and qualified primary schema', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ execute }));
    const insertInto = vi.fn(() => ({ values }));
    const withSchema = vi.fn(() => ({ insertInto }));
    const database = { withSchema };
    const store = new KyselyAuditOutboxStore(database as never, {
      primarySchema: 'custom_audit',
      maximumCanonicalPayloadBytes: 65_536,
    });

    await store.append(event);

    expect(withSchema).toHaveBeenCalledWith('custom_audit');
    expect(insertInto).toHaveBeenCalledWith('audit_outbox');
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        event_public_id: expect.any(Buffer),
        action: 'auth.user.updated',
        entity_type: 'user',
        request_id: 'request-501',
        canonical_payload: expect.stringContaining('"schemaVersion":1'),
      }),
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects an invalid event before touching the database', async () => {
    const withSchema = vi.fn();
    const store = new KyselyAuditOutboxStore({ withSchema } as never, {
      primarySchema: 'custom_audit',
      maximumCanonicalPayloadBytes: 65_536,
    });

    await expect(
      store.append({
        ...event,
        metadata: { password: 'must-not-be-captured' } as never,
      }),
    ).rejects.toThrowError(/sensitive/i);
    expect(withSchema).not.toHaveBeenCalled();
  });

  it('enforces the configured final canonical byte limit', async () => {
    const store = new KyselyAuditOutboxStore({ withSchema: vi.fn() } as never, {
      primarySchema: 'custom_audit',
      maximumCanonicalPayloadBytes: 32,
    });

    await expect(store.append(event)).rejects.toThrowError(/bytes/i);
  });
});
