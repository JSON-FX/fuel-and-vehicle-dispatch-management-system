import { describe, expect, it, vi } from 'vitest';

import { CsrfError } from '@/application/shared/errors/application-error';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { withResponseHandler } from '@/lib/http/with-response-handler';

const requestId = '019c043f-422c-7141-8a03-a9d9bda3544a';

describe('withResponseHandler', () => {
  it('returns a no-store success envelope for plain data', async () => {
    const handler = withResponseHandler(dependencies(), async () => ({ next: 'AUTHENTICATED' }));

    const response = await handler(new Request('https://fvdms.lan/api/auth/login'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(requestId);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { next: 'AUTHENTICATED' },
      requestId,
    });
  });

  it('preserves a full response and adds the security headers', async () => {
    const handler = withResponseHandler(dependencies(), async () =>
      Response.json(
        { accepted: true },
        { status: 202, headers: { 'set-cookie': '__Host-fvdms_session=value; Secure' } },
      ),
    );

    const response = await handler(new Request('https://fvdms.lan/api/auth/login'));

    expect(response.status).toBe(202);
    expect(response.headers.get('set-cookie')).toContain('__Host-fvdms_session');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe(requestId);
    await expect(response.json()).resolves.toEqual({ accepted: true });
  });

  it('maps typed failures without exposing private values', async () => {
    const logger = createLogger();
    const handler = withResponseHandler({ ...dependencies(), logger }, async () => {
      throw Object.assign(new CsrfError(), { csrfToken: 'private-token' });
    });

    const response = await handler(new Request('https://fvdms.lan/api/auth/logout'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe('CSRF_INVALID');
    expect(JSON.stringify(body)).not.toContain('private-token');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});

function dependencies() {
  return {
    logger: createLogger(),
    publicIdGenerator: {
      generate: () => PublicId.from(requestId),
    } satisfies PublicIdGenerator,
  };
}

function createLogger(): Logger {
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}
