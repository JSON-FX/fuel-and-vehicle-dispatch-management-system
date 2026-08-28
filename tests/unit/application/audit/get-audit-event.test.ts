import { describe, expect, it, vi } from 'vitest';

import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { AuditReadTransaction } from '@/application/audit/ports/audit-read-transaction';
import { GetAuditEvent } from '@/application/audit/use-cases/get-audit-event';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const actorPublicId = '01900000-0000-7000-8000-000000001101';
const eventPublicId = '01900000-0000-7000-8000-000000001102';
const detail = {
  publicId: eventPublicId,
  sequence: '11',
  sourcePosition: '12',
  schemaVersion: 1 as const,
  occurredAt: '2026-08-28T08:30:00.000Z',
  actorPublicId: null,
  action: 'auth.login.failed',
  entity: null,
  requestId: 'request-1102',
  reasonCode: 'invalid_credentials',
  previousHashHex: '00'.repeat(32),
  recordHashHex: '11'.repeat(32),
  chainedAt: '2026-08-28T08:30:01.000Z',
  sensitive: null,
};

function useCase(input: {
  readonly found?: typeof detail | null;
  readonly append?: (event: AuditEventInput) => Promise<void>;
}) {
  const findByPublicId = vi
    .fn()
    .mockResolvedValue(input.found === undefined ? detail : input.found);
  const transaction: AuditReadTransaction = {
    execute: (work) =>
      work({
        queries: { search: vi.fn(), findByPublicId, findLatestVerification: vi.fn() },
        auditEvents: { append: input.append ?? (async () => undefined) },
      }),
  };
  return {
    findByPublicId,
    value: new GetAuditEvent({
      transaction,
      publicIds: {
        generate: () => PublicId.from('01900000-0000-7000-8000-000000001103'),
      },
      clock: { now: () => new Date('2026-08-28T08:30:02.000Z') },
    }),
  };
}

function principal(permissions: readonly string[]) {
  return { userPublicId: actorPublicId, permissions } as never;
}

describe('GetAuditEvent', () => {
  it('projects sensitive context only for the dedicated permission and records access', async () => {
    const captured: AuditEventInput[] = [];
    const { value, findByPublicId } = useCase({
      append: async (event) => {
        captured.push(event);
      },
    });

    await expect(
      value.execute({
        actor: principal(['audit.read', 'audit.read_sensitive']),
        eventPublicId,
        requestId: 'audit-detail-request',
        ipAddress: '2001:db8::1',
        userAgent: 'Audit detail browser',
      }),
    ).resolves.toBe(detail);
    expect(findByPublicId).toHaveBeenCalledWith(eventPublicId, true);
    expect(captured[0]).toMatchObject({
      action: 'audit.accessed',
      entity: { type: 'audit_event', publicId: eventPublicId },
      metadata: { accessType: 'detail', sensitiveContextIncluded: true },
    });
  });

  it('requests a redacted detail without audit.read_sensitive', async () => {
    const { value, findByPublicId } = useCase({});

    await value.execute({
      actor: principal(['audit.read']),
      eventPublicId,
      requestId: 'redacted-detail',
      ipAddress: null,
      userAgent: null,
    });
    expect(findByPublicId).toHaveBeenCalledWith(eventPublicId, false);
  });

  it('does not record access for a missing event', async () => {
    const append = vi.fn();
    const { value } = useCase({ found: null, append });

    await expect(
      value.execute({
        actor: principal(['audit.read']),
        eventPublicId,
        requestId: 'missing-detail',
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toMatchObject({ httpStatus: 404 });
    expect(append).not.toHaveBeenCalled();
  });
});
