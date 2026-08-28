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

    await expect(
      authenticateRequest(request, {
        authenticateSession: { execute },
        authorizePermission: { execute: authorize },
        permission: 'dispatch.read',
      }),
    ).resolves.toEqual({ ...session, bearerToken: 'opaque-session' });
    expect(execute).toHaveBeenCalledWith('opaque-session');
    expect(authorize).toHaveBeenCalledWith(session.principal, 'dispatch.read');
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
    const authenticateSession = {
      execute: vi.fn().mockResolvedValue({ principal: {}, sessionPublicId: 'session' }),
    };
    const authorizePermission = {
      execute: vi.fn(() => {
        throw new AuthorizationError();
      }),
    };

    await expect(
      authenticateRequest(
        new Request('https://fvdms.lan/api/users', {
          headers: { cookie: `${AUTH_SESSION_COOKIE}=opaque-session` },
        }),
        { authenticateSession, authorizePermission, permission: 'user.read' },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
