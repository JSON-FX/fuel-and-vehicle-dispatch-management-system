import { describe, expect, it } from 'vitest';

import {
  AUTH_CHALLENGE_COOKIE,
  AUTH_SESSION_COOKIE,
  createAuthCookie,
  deleteAuthCookie,
  readAuthCookie,
} from '@/lib/auth/cookies';

describe('authentication cookies', () => {
  it.each([AUTH_SESSION_COOKIE, AUTH_CHALLENGE_COOKIE] as const)(
    'uses the fixed host-only security contract for %s',
    (name) => {
      const expiresAt = new Date('2026-08-28T10:00:00.000Z');

      expect(createAuthCookie(name, 'opaque-token', expiresAt)).toEqual({
        name,
        value: 'opaque-token',
        options: {
          expires: expiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'strict',
          secure: true,
        },
      });
    },
  );

  it('deletes a cookie with the same name and security scope', () => {
    expect(deleteAuthCookie(AUTH_SESSION_COOKIE)).toEqual({
      name: AUTH_SESSION_COOKIE,
      value: '',
      options: {
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'strict',
        secure: true,
      },
    });
  });

  it('extracts and decodes an exact cookie without accepting a similarly named cookie', () => {
    const request = new Request('https://fvdms.lan/api/me', {
      headers: {
        cookie:
          '__Host-fvdms_session_backup=wrong; __Host-fvdms_session=opaque%20token; preference=compact',
      },
    });

    expect(readAuthCookie(request, AUTH_SESSION_COOKIE)).toBe('opaque token');
    expect(readAuthCookie(request, AUTH_CHALLENGE_COOKIE)).toBeNull();
  });
});
