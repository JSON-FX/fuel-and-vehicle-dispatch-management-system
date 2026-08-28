import { describe, expect, it, vi } from 'vitest';

import type { AuditEventInput, AuditEventPageDto } from '@/application/audit/dto/audit-event-dtos';
import type { AuditReadTransaction } from '@/application/audit/ports/audit-read-transaction';
import { SearchAuditEvents } from '@/application/audit/use-cases/search-audit-events';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const actorPublicId = '01900000-0000-7000-8000-000000001001';
const eventPublicId = '01900000-0000-7000-8000-000000001002';
const auditPublicId = '01900000-0000-7000-8000-000000001003';
const page: AuditEventPageDto = {
  items: [
    {
      publicId: eventPublicId,
      sequence: '9',
      occurredAt: '2026-08-28T08:00:00.000Z',
      actorPublicId,
      action: 'auth.login.succeeded',
      entity: null,
      requestId: 'request-1002',
    },
  ],
  previousCursor: null,
  nextCursor: null,
};

function dependencies(append: (event: AuditEventInput) => Promise<void> = async () => undefined) {
  const search = vi.fn().mockResolvedValue(page);
  const transaction: AuditReadTransaction = {
    execute: (work) =>
      work({
        queries: {
          search,
          findByPublicId: vi.fn(),
          findLatestVerification: vi.fn(),
        },
        auditEvents: { append },
      }),
  };
  return {
    search,
    useCase: new SearchAuditEvents({
      transaction,
      publicIds: { generate: () => PublicId.from(auditPublicId) },
      clock: { now: () => new Date('2026-08-28T08:00:01.000Z') },
    }),
  };
}

const principal = {
  userPublicId: actorPublicId,
  permissions: ['audit.read'],
} as never;

describe('SearchAuditEvents', () => {
  it('returns a bounded structured page and appends one audit-safe access event', async () => {
    const captured: AuditEventInput[] = [];
    const { useCase, search } = dependencies(async (event) => {
      captured.push(event);
    });

    await expect(
      useCase.execute({
        actor: principal,
        requestId: 'audit-search-request',
        ipAddress: '192.0.2.20',
        userAgent: 'Audit browser',
        query: {
          from: '2026-08-01T00:00:00.000Z',
          to: '2026-08-31T23:59:59.999Z',
          action: 'auth.login.succeeded',
          entityType: null,
          entityPublicId: null,
          actorPublicId,
          requestId: null,
          cursor: null,
          pageSize: 25,
        },
      }),
    ).resolves.toBe(page);
    expect(search).toHaveBeenCalledOnce();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({
      action: 'audit.accessed',
      actorPublicId,
      requestId: 'audit-search-request',
      ipAddress: '192.0.2.20',
      userAgent: 'Audit browser',
      metadata: {
        accessType: 'search',
        filterCategories: ['from', 'to', 'action', 'actorPublicId'],
        returnedCount: 1,
      },
    });
  });

  it('rejects invalid time ranges and page sizes before opening the transaction', async () => {
    const { useCase, search } = dependencies();
    const base = {
      actor: principal,
      requestId: 'invalid-search',
      ipAddress: null,
      userAgent: null,
      query: {
        from: '2026-08-31T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
        action: null,
        entityType: null,
        entityPublicId: null,
        actorPublicId: null,
        requestId: null,
        cursor: null,
        pageSize: 101,
      },
    };

    await expect(useCase.execute(base)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(search).not.toHaveBeenCalled();
  });

  it('does not acknowledge a search when durable access capture fails', async () => {
    const { useCase } = dependencies(async () => {
      throw new Error('outbox unavailable');
    });

    await expect(
      useCase.execute({
        actor: principal,
        requestId: 'failed-search',
        ipAddress: null,
        userAgent: null,
        query: {
          from: null,
          to: null,
          action: null,
          entityType: null,
          entityPublicId: null,
          actorPublicId: null,
          requestId: null,
          cursor: null,
          pageSize: 50,
        },
      }),
    ).rejects.toThrow('outbox unavailable');
  });
});
