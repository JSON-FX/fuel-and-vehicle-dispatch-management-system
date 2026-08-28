import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  authorizePermission: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: mocks.authorizePermission },
    listUsers: { execute: mocks.listUsers },
    createUser: { execute: mocks.createUser },
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

import { GET, POST } from '@/app/api/users/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'administrator',
  fullName: 'System Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['user.read', 'user.manage'],
  isPrivileged: true,
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

describe('/api/users', () => {
  it('enforces user.read and bounds pagination', async () => {
    mocks.listUsers.mockResolvedValue({ items: [], page: 2, pageSize: 100, total: 0 });
    const response = await GET(
      authenticatedRequest('https://fvdms.lan/api/users?page=2&pageSize=100'),
    );

    expect(response.status).toBe(200);
    expect(mocks.authorizePermission).toHaveBeenCalledWith(principal, 'user.read');
    expect(mocks.listUsers).toHaveBeenCalledWith({ actor: principal, page: 2, pageSize: 100 });
  });

  it('requires session-bound CSRF before creating a user', async () => {
    mocks.createUser.mockResolvedValue({
      targetPublicId: '019c043f-422c-7141-8a03-a9d9bda3544d',
      temporaryPassword: 'one-time-password',
    });
    const response = await POST(
      authenticatedRequest('https://fvdms.lan/api/users', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://fvdms.lan',
          'sec-fetch-site': 'same-origin',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({
          username: 'new.user',
          email: 'new.user@example.lan',
          fullName: 'New User',
          rolePublicIds: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.authorizePermission).toHaveBeenCalledWith(principal, 'user.manage');
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({ actor: principal }));
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}
