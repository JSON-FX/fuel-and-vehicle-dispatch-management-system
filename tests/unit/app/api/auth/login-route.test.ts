import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({ login: vi.fn() }));
const requestId = '019c043f-422c-7141-8a03-a9d9bda3544a';

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    login: { execute: mocks.login },
    authAllowedOrigin: 'https://fvdms.lan',
    logger: logger(),
    publicIdGenerator: { generate: () => PublicId.from(requestId) },
  }),
}));

import { POST } from '@/app/api/auth/login/route';

beforeEach(() => vi.clearAllMocks());

describe('POST /api/auth/login', () => {
  it('sets only the opaque session cookie and returns the CSRF token', async () => {
    mocks.login.mockResolvedValue({
      next: 'AUTHENTICATED',
      credential: {
        bearerToken: 'opaque-session',
        csrfToken: 'csrf-token',
        expiresAt: new Date('2026-08-28T12:00:00.000Z'),
      },
      principal: { userPublicId: 'user-id', permissions: [] },
    });
    const response = await POST(
      new Request('https://fvdms.lan/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://fvdms.lan',
          'sec-fetch-site': 'same-origin',
          'x-forwarded-for': '10.0.0.8, 10.0.0.1',
        },
        body: JSON.stringify({ username: 'dispatcher', password: 'secret-password' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(
      /__Host-fvdms_session=opaque-session.*HttpOnly.*Secure.*SameSite=Strict/,
    );
    expect(JSON.stringify(body)).not.toContain('opaque-session');
    expect(body.data.csrfToken).toBe('csrf-token');
    expect(mocks.login).toHaveBeenCalledWith(
      expect.objectContaining({ sourceAddress: '10.0.0.8', requestId }),
    );
  });

  it('rejects a cross-origin login before checking credentials', async () => {
    const response = await POST(
      new Request('https://fvdms.lan/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
        body: JSON.stringify({ username: 'dispatcher', password: 'secret-password' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.login).not.toHaveBeenCalled();
  });
});

function logger() {
  const value = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  value.child.mockReturnValue(value);
  return value;
}
