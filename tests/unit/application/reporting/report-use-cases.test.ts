import { describe, expect, it, vi } from 'vitest';

import type { CurrentPrincipal } from '@/application/auth/dto/authentication-dtos';
import type { ExportJobRecord } from '@/application/reporting/dto/export-job-dtos';
import type { NormalizedReportFilters } from '@/application/reporting/dto/report-dtos';
import { DownloadExport } from '@/application/reporting/use-cases/download-export';
import { GetOwnExportJob } from '@/application/reporting/use-cases/get-own-export-job';
import { GetReport } from '@/application/reporting/use-cases/get-report';
import { GetReportFilterOptions } from '@/application/reporting/use-cases/get-report-filter-options';
import { IssueExportDownloadLink } from '@/application/reporting/use-cases/issue-export-download-link';
import { ListOwnExportJobs } from '@/application/reporting/use-cases/list-own-export-jobs';
import { RequestReportExport } from '@/application/reporting/use-cases/request-report-export';
import {
  AuthorizationError,
  BusinessRuleError,
  NotFoundError,
} from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const principal: CurrentPrincipal = {
  userPublicId: '01900000-0000-7000-8000-000000000901',
  username: 'fuel.staff',
  fullName: 'Fuel Staff',
  roles: ['PSMD_STAFF'],
  permissions: ['fuel.read', 'fuel.export'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};
const context = {
  principal,
  requestId: 'request-1',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest',
};
const now = new Date('2026-08-29T03:00:00.000Z');
const filters: NormalizedReportFilters = {
  reportType: 'FUEL_ISSUANCE',
  requestingOfficePublicId: null,
  periodType: 'MONTHLY',
  referenceDate: '2026-08-29',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: null,
  cursor: null,
  pageSize: 100,
};
const job: ExportJobRecord = {
  id: '1',
  publicId: '01900000-0000-7000-8000-000000000902',
  requesterUserId: '10',
  requesterPublicId: principal.userPublicId,
  reportType: 'FUEL_ISSUANCE',
  periodType: 'MONTHLY',
  filters,
  filterHash: 'ab'.repeat(32),
  mode: 'QUEUED',
  status: 'QUEUED',
  estimatedRows: 10,
  actualRows: null,
  attempts: 0,
  maxAttempts: 3,
  storageKey: null,
  filename: null,
  mimeType: null,
  byteLength: null,
  sha256: null,
  failureCode: null,
  failureMessage: null,
  requestedAt: now.toISOString(),
  startedAt: null,
  finishedAt: null,
  fileExpiresAt: null,
  availableAt: now,
  leaseOwner: null,
  leaseExpiresAt: null,
  createdAt: now,
  updatedAt: now,
};

function requester() {
  return {
    findByPublicId: vi.fn().mockResolvedValue({
      id: '10',
      principal,
      isActive: true,
      deletedAt: null,
    }),
  };
}

describe('reporting use cases', () => {
  it('authorizes reads before querying', async () => {
    const queries = {
      getReport: vi.fn().mockResolvedValue({ reportType: 'FUEL_ISSUANCE' }),
    };
    const useCase = new GetReport({
      queries: queries as never,
      permissions: { assertCanRead: vi.fn() } as never,
      clock: { now: () => now },
    });
    await expect(useCase.execute({ context, filters })).resolves.toMatchObject({
      reportType: 'FUEL_ISSUANCE',
    });
    expect(queries.getReport).toHaveBeenCalledWith(filters, now);

    const denied = new GetReport({
      queries: queries as never,
      permissions: {
        assertCanRead: () => {
          throw new AuthorizationError();
        },
      } as never,
      clock: { now: () => now },
    });
    await expect(denied.execute({ context, filters })).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('completes estimates at or below 1,000 synchronously and queues annual exports', async () => {
    const exportJobs = {
      start: vi.fn().mockResolvedValue({ ...job, mode: 'SYNCHRONOUS', status: 'RUNNING' }),
    };
    const executor = {
      execute: vi.fn().mockResolvedValue({
        ...job,
        mode: 'SYNCHRONOUS',
        status: 'COMPLETED',
      }),
    };
    const create = vi.fn().mockImplementation((input) => ({ ...job, ...input }));
    const transaction = {
      execute: vi.fn(async (work) =>
        work({ exportJobs: { create }, auditEvents: { append: vi.fn() } }),
      ),
    };
    const useCase = new RequestReportExport({
      queries: { estimateRows: vi.fn().mockResolvedValue(1_000) } as never,
      exportJobs: exportJobs as never,
      transaction: transaction as never,
      requesters: requester() as never,
      permissions: { assertCanExport: vi.fn() } as never,
      publicIds: { generate: () => PublicId.from(job.publicId) },
      clock: { now: () => now },
      executor: executor as never,
    });

    await expect(useCase.execute({ context, filters })).resolves.toMatchObject({
      httpStatus: 201,
      job: { status: 'COMPLETED', mode: 'SYNCHRONOUS' },
    });
    expect(exportJobs.start).toHaveBeenCalled();

    const annual = { ...filters, periodType: 'ANNUAL' as const };
    await expect(useCase.execute({ context, filters: annual })).resolves.toMatchObject({
      httpStatus: 202,
      job: { mode: 'QUEUED' },
    });
  });

  it('rejects estimates beyond the hard row limit before creating a job', async () => {
    const transaction = { execute: vi.fn() };
    const useCase = new RequestReportExport({
      queries: { estimateRows: vi.fn().mockResolvedValue(100_001) } as never,
      exportJobs: {} as never,
      transaction: transaction as never,
      requesters: requester() as never,
      permissions: { assertCanExport: vi.fn() } as never,
      publicIds: { generate: () => PublicId.from(job.publicId) },
      clock: { now: () => now },
      executor: {} as never,
    });
    await expect(useCase.execute({ context, filters })).rejects.toBeInstanceOf(BusinessRuleError);
    expect(transaction.execute).not.toHaveBeenCalled();
  });

  it('lists only jobs resolved to the current user', async () => {
    const listOwn = vi.fn().mockResolvedValue([job]);
    const useCase = new ListOwnExportJobs({
      exportJobs: { listOwn } as never,
      requesters: requester() as never,
    });
    await expect(useCase.execute({ context, limit: 20 })).resolves.toEqual([
      expect.not.objectContaining({ storageKey: expect.anything() }),
    ]);
    expect(listOwn).toHaveBeenCalledWith('10', 20);
  });

  it('returns only the current requester own job and hides missing ownership', async () => {
    const findOwn = vi.fn().mockResolvedValue(job);
    const useCase = new GetOwnExportJob({
      exportJobs: { findOwn } as never,
      requesters: requester() as never,
    });
    await expect(
      useCase.execute({ context, exportJobPublicId: job.publicId }),
    ).resolves.toMatchObject({ publicId: job.publicId });
    expect(findOwn).toHaveBeenCalledWith(job.publicId, '10');

    findOwn.mockResolvedValueOnce(null);
    await expect(
      useCase.execute({ context, exportJobPublicId: job.publicId }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each([
    null,
    { id: '10', principal, isActive: false, deletedAt: null },
    { id: '10', principal, isActive: true, deletedAt: new Date() },
  ])('rejects an unavailable requester before loading an own job', async (currentRequester) => {
    const findOwn = vi.fn();
    const useCase = new GetOwnExportJob({
      exportJobs: { findOwn } as never,
      requesters: { findByPublicId: vi.fn().mockResolvedValue(currentRequester) } as never,
    });
    await expect(
      useCase.execute({ context, exportJobPublicId: job.publicId }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(findOwn).not.toHaveBeenCalled();
  });

  it('authorizes dashboard filter options before querying active offices', async () => {
    const getFilterOptions = vi.fn().mockResolvedValue({ offices: [] });
    const canAccessDashboard = vi.fn().mockReturnValue(true);
    const useCase = new GetReportFilterOptions({
      queries: { getFilterOptions } as never,
      permissions: { canAccessDashboard } as never,
    });
    await expect(useCase.execute(context)).resolves.toEqual({ offices: [] });
    canAccessDashboard.mockReturnValueOnce(false);
    await expect(useCase.execute(context)).rejects.toBeInstanceOf(AuthorizationError);
    expect(getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('does not issue an own-job link beyond the remaining file lifetime', async () => {
    const completed = {
      ...job,
      status: 'COMPLETED' as const,
      storageKey: 'opaque.xlsx',
      fileExpiresAt: new Date(now.valueOf() + 60_000).toISOString(),
    };
    const createDownloadToken = vi.fn();
    const useCase = new IssueExportDownloadLink({
      exportJobs: { findOwn: vi.fn().mockResolvedValue(completed) } as never,
      transaction: {
        execute: async (
          work: (repositories: {
            exportJobs: { createDownloadToken: typeof createDownloadToken };
            auditEvents: Record<string, never>;
          }) => Promise<unknown>,
        ) => work({ exportJobs: { createDownloadToken }, auditEvents: {} }),
      } as never,
      requesters: requester() as never,
      permissions: { assertCanExport: vi.fn() } as never,
      tokens: {
        issue: () => ({ rawToken: 'raw-token', tokenHash: new Uint8Array(32) }),
      } as never,
      clock: { now: () => now },
    });
    await expect(useCase.execute({ context, exportJobPublicId: job.publicId })).resolves.toEqual({
      url: `/api/report-exports/${job.publicId}/download?token=raw-token`,
      expiresAt: new Date(now.valueOf() + 60_000).toISOString(),
    });
    expect(createDownloadToken).toHaveBeenCalled();
  });

  it('consumes a token with audit evidence before returning a private stream', async () => {
    const completed = {
      ...job,
      status: 'COMPLETED' as const,
      storageKey: 'opaque.xlsx',
      filename: 'report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      byteLength: 5,
      fileExpiresAt: new Date(now.valueOf() + 60_000).toISOString(),
    };
    const append = vi.fn();
    const consumeDownloadToken = vi.fn().mockResolvedValue(true);
    const stream = new ReadableStream<Uint8Array>();
    const useCase = new DownloadExport({
      exportJobs: { findOwn: vi.fn().mockResolvedValue(completed) } as never,
      transaction: {
        execute: async (
          work: (repositories: {
            exportJobs: { consumeDownloadToken: typeof consumeDownloadToken };
            auditEvents: { append: typeof append };
          }) => Promise<unknown>,
        ) => work({ exportJobs: { consumeDownloadToken }, auditEvents: { append } }),
      } as never,
      requesters: requester() as never,
      permissions: { assertCanExport: vi.fn() } as never,
      tokens: { hash: () => new Uint8Array(32) } as never,
      storage: { open: vi.fn().mockResolvedValue({ byteLength: 5, stream }) } as never,
      publicIds: { generate: () => PublicId.from(fuelPublicIdForAudit()) },
      clock: { now: () => now },
    });

    await expect(
      useCase.execute({ context, exportJobPublicId: job.publicId, rawToken: 'raw-token' }),
    ).resolves.toMatchObject({ filename: 'report.xlsx', byteLength: 5, stream });
    expect(consumeDownloadToken).toHaveBeenCalled();
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'report.export.download_authorized' }),
    );

    consumeDownloadToken.mockResolvedValue(false);
    await expect(
      useCase.execute({ context, exportJobPublicId: job.publicId, rawToken: 'raw-token' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

function fuelPublicIdForAudit(): string {
  return '01900000-0000-7000-8000-000000000999';
}
