import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  authorizePermission: vi.fn(),
  listRoles: vi.fn(),
  createRole: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: mocks.authorizePermission },
    listRoles: { execute: mocks.listRoles },
    createRole: { execute: mocks.createRole },
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

import { GET, POST } from '@/app/api/roles/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'administrator',
  fullName: 'System Administrator',
  roles: ['SUPER_ADMIN'],
  permissions: ['role.read', 'role.manage', 'role.assign_privileged'],
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

describe('/api/roles', () => {
  it('enforces role.read for the role catalog', async () => {
    mocks.listRoles.mockResolvedValue([]);
    const response = await GET(authenticatedRequest('https://fvdms.lan/api/roles'));

    expect(response.status).toBe(200);
    expect(mocks.authorizePermission).toHaveBeenCalledWith(principal, 'role.read');
  });

  it('passes privileged role creation through the authoritative use case', async () => {
    mocks.createRole.mockResolvedValue('019c043f-422c-7141-8a03-a9d9bda3544d');
    const response = await POST(
      authenticatedRequest('https://fvdms.lan/api/roles', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://fvdms.lan',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({
          name: 'Regional Administrator',
          isPrivileged: true,
          permissionPublicIds: [],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createRole).toHaveBeenCalledWith(
      expect.objectContaining({ actor: principal, isPrivileged: true }),
    );
  });
});

function authenticatedRequest(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request(url, { ...init, headers });
}
