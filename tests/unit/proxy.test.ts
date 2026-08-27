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
});
