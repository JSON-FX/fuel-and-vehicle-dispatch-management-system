import { describe, expect, it, vi } from 'vitest';

import type {
  AuditEventDetailDto,
  AuditEventInput,
  AuditEventPageDto,
  AuditSearchQuery,
  AuditVerificationStatusDto,
} from '@/application/audit/dto/audit-event-dtos';
import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { AuditQueryRepository } from '@/application/audit/ports/audit-query-repository';
import type { AuditReadTransaction } from '@/application/audit/ports/audit-read-transaction';

const event: AuditEventInput = {
  publicId: '01900000-0000-7000-8000-000000000201',
  schemaVersion: 1,
  occurredAt: '2026-08-28T00:00:00.000Z',
  actorPublicId: null,
  action: 'audit.accessed',
  entity: null,
  requestId: '01900000-0000-7000-8000-000000000202',
  ipAddress: null,
  userAgent: null,
  reasonCode: null,
  before: null,
  after: null,
  metadata: { returnedCount: 1 },
};

const page: AuditEventPageDto = {
  items: [
    {
      publicId: event.publicId,
      sequence: '7',
      occurredAt: event.occurredAt,
      actorPublicId: null,
      action: event.action,
      entity: null,
      requestId: event.requestId,
    },
  ],
  previousCursor: null,
  nextCursor: 'opaque-next-cursor',
};

const verification: AuditVerificationStatusDto = {
  publicId: '01900000-0000-7000-8000-000000000203',
  status: 'PASS',
  highWaterSequence: '7',
  verifiedCount: '7',
  firstMismatchSequence: null,
  firstMismatchType: null,
  summary: 'Primary and sink records match.',
  startedAt: '2026-08-28T00:00:00.000Z',
  completedAt: '2026-08-28T00:00:01.000Z',
};

describe('audit application contracts', () => {
  it('keeps capture inside an explicit application port', async () => {
    const append = vi.fn<(input: AuditEventInput) => Promise<void>>().mockResolvedValue(undefined);
    const port: AuditEventPort = { append };

    await port.append(event);

    expect(append).toHaveBeenCalledWith(event);
  });

  it('combines a read repository and access-evidence port in one transaction', async () => {
    const query: AuditSearchQuery = {
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
    const detail: AuditEventDetailDto = {
      ...page.items[0]!,
      sourcePosition: '8',
      schemaVersion: 1,
      reasonCode: null,
      previousHashHex: '00'.repeat(32),
      recordHashHex: '11'.repeat(32),
      chainedAt: '2026-08-28T00:00:01.000Z',
      sensitive: null,
    };
    const queries: AuditQueryRepository = {
      search: vi.fn().mockResolvedValue(page),
      findByPublicId: vi.fn().mockResolvedValue(detail),
      findLatestVerification: vi.fn().mockResolvedValue(verification),
    };
    const auditEvents: AuditEventPort = { append: vi.fn().mockResolvedValue(undefined) };
    const transaction: AuditReadTransaction = {
      execute: (work) => work({ queries, auditEvents }),
    };

    const result = await transaction.execute(async (repositories) => {
      const found = await repositories.queries.search(query);
      await repositories.auditEvents.append(event);
      return found;
    });

    expect(result).toBe(page);
    expect(queries.search).toHaveBeenCalledWith(query);
    expect(auditEvents.append).toHaveBeenCalledWith(event);
  });

  it('uses strings for public BIGINT values and opaque cursors', () => {
    expect(page.items[0]?.sequence).toBe('7');
    expect(page.nextCursor).toBe('opaque-next-cursor');
    expect(verification.highWaterSequence).toBe('7');
  });
});
