import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanManage: vi.fn(),
  assertCanRead: vi.fn(),
  recordDenial: vi.fn(),
  listOffices: vi.fn(),
  listOperationalOfficeOptions: vi.fn(),
  createOffice: vi.fn(),
  softDeleteOffice: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: mocks.recordDenial },
    masterDataPermissions: {
      assertCanManage: mocks.assertCanManage,
      assertCanRead: mocks.assertCanRead,
    },
    listOffices: { execute: mocks.listOffices },
    listOperationalOfficeOptions: { execute: mocks.listOperationalOfficeOptions },
    createOffice: { execute: mocks.createOffice },
    softDeleteOffice: { execute: mocks.softDeleteOffice },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a'),
    },
  }),
}));

import { GET, POST } from '@/app/api/offices/route';
import { POST as SOFT_DELETE } from '@/app/api/offices/[officeId]/soft-delete/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'administrator',
  fullName: 'System Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['office.manage', 'office.read'],
  isPrivileged: true,
  mustChangePassword: false,
  mfaEnrolled: true,
};
const officeId = '019c043f-422c-7141-8a03-a9d9bda3544d';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: '019c043f-422c-7141-8a03-a9d9bda3544c',
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('/api/offices', () => {
  it('uses manage authorization for bounded administration lists', async () => {
    mocks.listOffices.mockResolvedValue({ items: [], nextCursor: null, previousCursor: null });
    const response = await GET(
      authenticatedRequest('https://fvdms.lan/api/offices?mode=admin&pageSize=200'),
    );
    expect(response.status).toBe(200);
    expect(mocks.assertCanManage).toHaveBeenCalledWith(principal, 'office');
    expect(mocks.listOffices).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ pageSize: 200 }) }),
    );
  });

  it('uses read-or-manage authorization for operational options', async () => {
    mocks.listOperationalOfficeOptions.mockResolvedValue({
      items: [],
      nextCursor: null,
      previousCursor: null,
    });
    const response = await GET(
      authenticatedRequest('https://fvdms.lan/api/offices?mode=operational'),
    );
    expect(response.status).toBe(200);
    expect(mocks.assertCanRead).toHaveBeenCalledWith(principal, 'office');
  });

  it('creates an office only after CSRF verification', async () => {
    mocks.createOffice.mockResolvedValue({ publicId: officeId, name: 'Budget Office' });
    const response = await POST(
      mutationRequest('https://fvdms.lan/api/offices', {
        name: 'Budget Office',
        abbreviation: 'BO',
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.createOffice).toHaveBeenCalledWith(
      expect.objectContaining({ command: { name: 'Budget Office', abbreviation: 'BO' } }),
    );
  });

  it('records authorization denials before returning 403', async () => {
    mocks.assertCanManage.mockImplementationOnce(() => {
      throw new AuthorizationError();
    });
    const response = await GET(authenticatedRequest('https://fvdms.lan/api/offices?mode=admin'));
    expect(response.status).toBe(403);
    expect(mocks.recordDenial).toHaveBeenCalledOnce();
  });

  it('soft-deletes through an explicit POST route with a reason', async () => {
    const response = await SOFT_DELETE(
      mutationRequest(`https://fvdms.lan/api/offices/${officeId}/soft-delete`, {
        reason: 'This office reference is obsolete.',
      }),
      { params: Promise.resolve({ officeId }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.softDeleteOffice).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: officeId, reason: 'This office reference is obsolete.' }),
    );
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}

function mutationRequest(url: string, body: unknown): Request {
  return authenticatedRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://fvdms.lan',
      'sec-fetch-site': 'same-origin',
      'x-csrf-token': 'csrf-token',
    },
    body: JSON.stringify(body),
  });
}
