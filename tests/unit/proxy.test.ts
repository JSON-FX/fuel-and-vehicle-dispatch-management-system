import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from '@/proxy';

const requestId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('proxy', () => {
  it('forwards and returns a valid request identifier', () => {
    const response = proxy(
      new NextRequest('https://fvdms.lan/api/health', {
        headers: { 'x-request-id': requestId },
      }),
    );

    expect(response.headers.get('x-request-id')).toBe(requestId);
    expect(response.headers.get('x-middleware-request-x-request-id')).toBe(requestId);
  });

  it('excludes framework assets from proxy execution', () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: '/_next/static/chunk.js',
      }),
    ).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/api/health' })).toBe(true);
  });

  it('redirects protected pages to login while preserving a safe relative return path', () => {
    const response = proxy(new NextRequest('https://fvdms.lan/admin/users?page=2'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://fvdms.lan/login?returnTo=%2Fadmin%2Fusers%3Fpage%3D2',
    );
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never redirects API requests so handlers can return JSON authorization errors', () => {
    const response = proxy(new NextRequest('https://fvdms.lan/api/users'));

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it.each(['/login', '/password-change', '/mfa/enroll', '/mfa/challenge'])(
    'redirects a session-bearing user away from completed auth page %s',
    (path) => {
      const response = proxy(
        new NextRequest(`https://fvdms.lan${path}`, {
          headers: { cookie: '__Host-fvdms_session=opaque-session' },
        }),
      );

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://fvdms.lan/account');
    },
  );

  it('rejects an external returnTo value when leaving login', () => {
    const response = proxy(
      new NextRequest('https://fvdms.lan/login?returnTo=https://evil.example', {
        headers: { cookie: '__Host-fvdms_session=opaque-session' },
      }),
    );

    expect(response.headers.get('location')).toBe('https://fvdms.lan/account');
  });

  it('allows the expired-session login route and clears the stale session cookie', () => {
    const response = proxy(
      new NextRequest('https://fvdms.lan/login?invalidSession=1', {
        headers: { cookie: '__Host-fvdms_session=stale-session' },
      }),
    );

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('__Host-fvdms_session=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
