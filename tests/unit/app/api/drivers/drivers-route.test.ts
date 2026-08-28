import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  assertCanManage: vi.fn(),
  assertCanRead: vi.fn(),
  listDrivers: vi.fn(),
  listOperationalDriverOptions: vi.fn(),
  createDriver: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: vi.fn() },
    recordAuthorizationDenial: { execute: vi.fn() },
    masterDataPermissions: {
      assertCanManage: mocks.assertCanManage,
      assertCanRead: mocks.assertCanRead,
    },
    listDrivers: { execute: mocks.listDrivers },
    listOperationalDriverOptions: { execute: mocks.listOperationalDriverOptions },
    createDriver: { execute: mocks.createDriver },
    authAllowedOrigin: 'https://fvdms.lan',
    secureTokenGenerator: {
      hashToken: (token: string) => new TextEncoder().encode(`hash:${token}`),
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: { generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a') },
  }),
}));

import { GET, POST } from '@/app/api/drivers/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'viewer',
  fullName: 'Reference Viewer',
  roles: ['VIEWER'],
  permissions: ['driver.read'],
  isPrivileged: false,
  mustChangePassword: false,
  mfaEnrolled: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateSession.mockResolvedValue({
    sessionPublicId: '019c043f-422c-7141-8a03-a9d9bda3544c',
    csrfTokenHash: new TextEncoder().encode('hash:csrf-token'),
    principal,
  });
});

describe('/api/drivers', () => {
  it('returns contact-free operational options to read-only principals', async () => {
    mocks.listOperationalDriverOptions.mockResolvedValue({
      items: [{ publicId: '019c043f-422c-7141-8a03-a9d9bda3544d', name: 'Juan Dela Cruz' }],
      nextCursor: null,
      previousCursor: null,
    });
    const response = await GET(
      authenticatedRequest('https://fvdms.lan/api/drivers?mode=operational'),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(mocks.assertCanRead).toHaveBeenCalledWith(principal, 'driver');
    expect(text).not.toContain('contactNumber');
    expect(text).not.toContain('0917');
  });

  it('rejects client-controlled selector lifecycle filters', async () => {
    const response = await GET(
      authenticatedRequest('https://fvdms.lan/api/drivers?mode=operational&lifecycle=all'),
    );
    expect(response.status).toBe(400);
    expect(mocks.listOperationalDriverOptions).not.toHaveBeenCalled();
  });

  it('requires manager authorization and CSRF before contact-bearing creates', async () => {
    mocks.createDriver.mockResolvedValue({ publicId: '019c043f-422c-7141-8a03-a9d9bda3544d' });
    const response = await POST(
      authenticatedRequest('https://fvdms.lan/api/drivers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://fvdms.lan',
          'sec-fetch-site': 'same-origin',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({ name: 'Juan Dela Cruz', contactNumber: '0917 123 4567' }),
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.assertCanManage).toHaveBeenCalledWith(principal, 'driver');
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}
