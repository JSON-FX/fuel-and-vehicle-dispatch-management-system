import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  authenticateSession: vi.fn(),
  authorizePermission: vi.fn(),
  getAuthenticationSettings: vi.fn(),
  updateAuthenticationSettings: vi.fn(),
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    authenticateSession: { execute: mocks.authenticateSession },
    authorizePermission: { execute: mocks.authorizePermission },
    getAuthenticationSettings: { execute: mocks.getAuthenticationSettings },
    updateAuthenticationSettings: { execute: mocks.updateAuthenticationSettings },
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

import { GET, PATCH } from '@/app/api/authentication-settings/route';

const principal = {
  userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
  username: 'administrator',
  fullName: 'System Administrator',
  roles: ['SYSTEM_ADMIN'],
  permissions: ['auth.settings.manage'],
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

describe('/api/authentication-settings', () => {
  it('returns the global MFA requirement to an authorized administrator', async () => {
    mocks.getAuthenticationSettings.mockResolvedValue({
      mfaRequired: false,
      updatedAt: new Date('2026-08-28T00:00:00.000Z'),
      updatedByUserPublicId: null,
    });

    const response = await GET(authenticatedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.authorizePermission).toHaveBeenCalledWith(principal, 'auth.settings.manage');
    expect(mocks.getAuthenticationSettings).toHaveBeenCalledWith(principal);
    expect(body.data.mfaRequired).toBe(false);
  });

  it('updates the setting with CSRF protection and clears a revoked privileged session', async () => {
    mocks.updateAuthenticationSettings.mockResolvedValue({
      settings: {
        mfaRequired: true,
        updatedAt: new Date('2026-08-28T12:00:00.000Z'),
        updatedByUserPublicId: principal.userPublicId,
      },
      reauthenticationRequired: true,
      revokedSessionCount: 2,
    });

    const response = await PATCH(
      authenticatedRequest({
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          origin: 'https://fvdms.lan',
          'sec-fetch-site': 'same-origin',
          'x-csrf-token': 'csrf-token',
        },
        body: JSON.stringify({ mfaRequired: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateAuthenticationSettings).toHaveBeenCalledWith({
      actor: principal,
      mfaRequired: true,
      requestId: '019c043f-422c-7141-8a03-a9d9bda3544a',
    });
    expect(response.headers.get('set-cookie')).toMatch(/__Host-fvdms_session=.*Max-Age=0/);
  });
});

function authenticatedRequest(init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('cookie', '__Host-fvdms_session=opaque-session');
  return new Request('https://fvdms.lan/api/authentication-settings', { ...init, headers });
}
