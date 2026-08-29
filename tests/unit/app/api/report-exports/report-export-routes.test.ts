import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanExport: vi.fn(),
  requestExport: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  issueLink: vi.fn(),
  download: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: vi.fn() },
    reportPermissions: { assertCanExport: mocks.assertCanExport },
    requestReportExport: { execute: mocks.requestExport },
    listOwnExportJobs: { execute: mocks.list },
    getOwnExportJob: { execute: mocks.get },
    issueExportDownloadLink: { execute: mocks.issueLink },
    downloadExport: { execute: mocks.download },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('01900000-0000-7000-8000-000000000099'),
    },
  }),
}));

import { GET as LIST, POST as REQUEST_EXPORT } from '@/app/api/report-exports/route';
import { GET as GET_JOB } from '@/app/api/report-exports/[exportJobId]/route';
import { POST as ISSUE_LINK } from '@/app/api/report-exports/[exportJobId]/download-link/route';
import { GET as DOWNLOAD } from '@/app/api/report-exports/[exportJobId]/download/route';

const jobId = '01900000-0000-7000-8000-000000000010';
const routeContext = { params: Promise.resolve({ exportJobId: jobId }) };
const principal = {
  userPublicId: '01900000-0000-7000-8000-000000000001',
  username: 'fuel.staff',
  fullName: 'Fuel Staff',
  roles: ['PSMD_STAFF'],
  permissions: ['fuel.read', 'fuel.export'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: principal.userPublicId,
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
  mocks.requestExport.mockResolvedValue({ httpStatus: 202, job: { publicId: jobId } });
  mocks.list.mockResolvedValue([]);
  mocks.get.mockResolvedValue({ publicId: jobId });
  mocks.issueLink.mockResolvedValue({ url: '/download', expiresAt: '2026-08-29T00:05:00Z' });
  mocks.download.mockResolvedValue({
    filename: 'fuel-report.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    byteLength: 5,
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('bytes'));
        controller.close();
      },
    }),
  });
});

describe('report export routes', () => {
  it('returns 202 for queued requests and rejects client-owned fields', async () => {
    const queued = await REQUEST_EXPORT(
      mutationRequest('/api/report-exports', {
        reportType: 'FUEL_ISSUANCE',
        periodType: 'MONTHLY',
        referenceDate: '2026-08-29',
      }),
    );
    expect(queued.status).toBe(202);

    const invalid = await REQUEST_EXPORT(
      mutationRequest('/api/report-exports', {
        reportType: 'FUEL_ISSUANCE',
        periodType: 'MONTHLY',
        referenceDate: '2026-08-29',
        ownerId: '10',
        storageKey: '/tmp/report.xlsx',
      }),
    );
    expect(invalid.status).toBe(400);
  });

  it('lists and gets only through own-job use cases', async () => {
    expect((await LIST(authenticatedRequest('/api/report-exports?limit=20'))).status).toBe(200);
    expect(
      (await GET_JOB(authenticatedRequest(`/api/report-exports/${jobId}`), routeContext)).status,
    ).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(mocks.get).toHaveBeenCalledWith(expect.objectContaining({ exportJobPublicId: jobId }));
  });

  it('requires CSRF to mint a link and streams one-time downloads with safe headers', async () => {
    const withoutCsrf = await ISSUE_LINK(
      mutationRequest(`/api/report-exports/${jobId}/download-link`, {}, false),
      routeContext,
    );
    expect(withoutCsrf.status).toBe(403);

    const linked = await ISSUE_LINK(
      mutationRequest(`/api/report-exports/${jobId}/download-link`, {}),
      routeContext,
    );
    expect(linked.status).toBe(200);

    const downloaded = await DOWNLOAD(
      authenticatedRequest(`/api/report-exports/${jobId}/download?token=${'a'.repeat(43)}`),
      routeContext,
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-disposition')).toBe(
      'attachment; filename="fuel-report.xlsx"',
    );
    expect(downloaded.headers.get('cache-control')).toBe('no-store');
    expect(downloaded.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await downloaded.text()).toBe('bytes');
  });
});

function authenticatedRequest(path: string): Request {
  return new Request(`https://fvdms.lan${path}`, {
    headers: { cookie: '__Host-fvdms_session=session-token', 'user-agent': 'Vitest' },
  });
}

function mutationRequest(path: string, body: unknown, csrf = true): Request {
  return new Request(`https://fvdms.lan${path}`, {
    method: 'POST',
    headers: {
      cookie: '__Host-fvdms_session=session-token',
      origin: 'https://fvdms.lan',
      'content-type': 'application/json',
      ...(csrf ? { 'x-csrf-token': 'csrf-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}
