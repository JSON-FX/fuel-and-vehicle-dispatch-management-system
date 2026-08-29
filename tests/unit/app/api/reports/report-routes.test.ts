import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanRead: vi.fn(),
  recordDenial: vi.fn(),
  getReport: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    reportPermissions: { assertCanRead: mocks.assertCanRead },
    getReport: { execute: mocks.getReport },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('01900000-0000-7000-8000-000000000099'),
    },
  }),
}));

import { GET } from '@/app/api/reports/[reportType]/route';

const principal = {
  userPublicId: '01900000-0000-7000-8000-000000000001',
  username: 'fuel.staff',
  fullName: 'Fuel Staff',
  roles: ['PSMD_STAFF'],
  permissions: ['fuel.read'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: principal.userPublicId,
    csrfTokenHash: new Uint8Array(32),
    principal,
  });
  mocks.getReport.mockResolvedValue({ reportType: 'FUEL_ISSUANCE', rows: [] });
});

describe('report routes', () => {
  it('authenticates, authorizes the exact report, and passes strict normalized filters', async () => {
    const response = await GET(
      authenticatedRequest(
        'https://fvdms.lan/api/reports/FUEL_ISSUANCE?periodType=MONTHLY&referenceDate=2026-08-29&status=POSTED',
      ),
      { params: Promise.resolve({ reportType: 'FUEL_ISSUANCE' }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.assertCanRead).toHaveBeenCalledWith(principal, 'FUEL_ISSUANCE');
    expect(mocks.getReport).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ principal }),
        filters: expect.objectContaining({
          reportType: 'FUEL_ISSUANCE',
          startDate: '2026-08-01',
          endDate: '2026-08-31',
          status: 'POSTED',
        }),
      }),
    );
  });

  it('rejects unauthenticated, duplicate, and unknown report queries', async () => {
    mocks.authenticateSession.mockRejectedValueOnce(new Error('not reached without cookie'));
    const unauthenticated = await GET(new Request('https://fvdms.lan/api/reports/FUEL_ISSUANCE'), {
      params: Promise.resolve({ reportType: 'FUEL_ISSUANCE' }),
    });
    expect(unauthenticated.status).toBe(401);

    const invalid = await GET(
      authenticatedRequest(
        'https://fvdms.lan/api/reports/FUEL_ISSUANCE?periodType=MONTHLY&periodType=ANNUAL&owner=10',
      ),
      { params: Promise.resolve({ reportType: 'FUEL_ISSUANCE' }) },
    );
    expect(invalid.status).toBe(400);
  });
});

function authenticatedRequest(url: string): Request {
  return new Request(url, { headers: { cookie: '__Host-fvdms_session=session-token' } });
}
