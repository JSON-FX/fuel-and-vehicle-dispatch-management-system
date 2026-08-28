import { describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  AuthorizationError,
} from '@/application/shared/errors/application-error';
import { authenticateRequest } from '@/lib/auth/authenticated-request';
import { AUTH_SESSION_COOKIE } from '@/lib/auth/cookies';

describe('authenticateRequest', () => {
  it('resolves the session authoritatively and enforces the exact permission', async () => {
    const session = {
      sessionPublicId: '019c043f-422c-7141-8a03-a9d9bda3544a',
      csrfTokenHash: new Uint8Array([1, 2, 3]),
      principal: {
        userPublicId: '019c043f-422c-7141-8a03-a9d9bda3544b',
        username: 'dispatcher',
        fullName: 'Dispatch Officer',
        roles: ['DISPATCH_OFFICER'],
        permissions: ['dispatch.read'],
        isPrivileged: false,
        mustChangePassword: false,
        mfaEnrolled: false,
      },
    } as const;
    const execute = vi.fn().mockResolvedValue(session);
    const authorize = vi.fn();
    const request = new Request('https://fvdms.lan/api/me', {
      headers: { cookie: `${AUTH_SESSION_COOKIE}=opaque-session` },
    });
    const recordAuthorizationDenial = { execute: vi.fn() };

    await expect(
      authenticateRequest(request, {
        authenticateSession: { execute },
        authorizePermission: { execute: authorize },
        recordAuthorizationDenial,
        permission: 'dispatch.read',
        requestId: 'request-allowed',
        routeTemplate: '/api/me',
      }),
    ).resolves.toEqual({ ...session, bearerToken: 'opaque-session' });
    expect(execute).toHaveBeenCalledWith('opaque-session');
    expect(authorize).toHaveBeenCalledWith(session.principal, 'dispatch.read');
    expect(recordAuthorizationDenial.execute).not.toHaveBeenCalled();
  });

  it('rejects a request without a session cookie', async () => {
    await expect(
      authenticateRequest(new Request('https://fvdms.lan/api/me'), {
        authenticateSession: { execute: vi.fn() },
        authorizePermission: { execute: vi.fn() },
      }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('propagates permission denial from the authoritative guard', async () => {
    const principal = {
      userPublicId: '01900000-0000-7000-8000-000000000711',
      permissions: [],
    };
    const authenticateSession = {
      execute: vi.fn().mockResolvedValue({ principal, sessionPublicId: 'session' }),
    };
    const authorizePermission = {
      execute: vi.fn(() => {
        throw new AuthorizationError();
      }),
    };
    const recordAuthorizationDenial = { execute: vi.fn().mockResolvedValue(undefined) };

    await expect(
      authenticateRequest(
        new Request('https://fvdms.lan/api/users', {
          headers: {
            cookie: `${AUTH_SESSION_COOKIE}=opaque-session`,
            'user-agent': 'Test browser',
            'x-forwarded-for': '192.0.2.44, 10.0.0.1',
          },
        }),
        {
          authenticateSession,
          authorizePermission,
          recordAuthorizationDenial,
          permission: 'user.read',
          requestId: 'request-denied',
          routeTemplate: '/api/users',
        },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(recordAuthorizationDenial.execute).toHaveBeenCalledWith({
      principal,
      permission: 'user.read',
      requestId: 'request-denied',
      routeTemplate: '/api/users',
      sourceAddress: '192.0.2.44',
      userAgent: 'Test browser',
    });
  });

  it('does not return a denial before its evidence is durable', async () => {
    const persistenceFailure = new Error('audit database unavailable');
    const principal = {
      userPublicId: '01900000-0000-7000-8000-000000000712',
      permissions: [],
    };

    await expect(
      authenticateRequest(
        new Request('https://fvdms.lan/api/audit-events', {
          headers: { cookie: `${AUTH_SESSION_COOKIE}=opaque-session` },
        }),
        {
          authenticateSession: {
            execute: vi.fn().mockResolvedValue({ principal, sessionPublicId: 'session' }),
          },
          authorizePermission: {
            execute: vi.fn(() => {
              throw new AuthorizationError();
            }),
          },
          recordAuthorizationDenial: { execute: vi.fn().mockRejectedValue(persistenceFailure) },
          permission: 'audit.read',
          requestId: 'request-audit-denied',
          routeTemplate: '/api/audit-events',
        },
      ),
    ).rejects.toBe(persistenceFailure);
  });
});
