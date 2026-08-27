import { describe, expect, it, vi } from 'vitest';

import { ExternalDependencyError } from '@/application/shared/errors/application-error';
import type { Logger } from '@/application/shared/ports/logger';
import type { PublicIdGenerator } from '@/application/shared/ports/public-id-generator';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { withApiHandler } from '@/lib/http/with-api-handler';

const requestId = '019c043f-422c-7141-8a03-a9d9bda3544a';

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

const publicIdGenerator: PublicIdGenerator = {
  generate: () => PublicId.from(requestId),
};

describe('withApiHandler', () => {
  it('returns a success envelope and request identifier header', async () => {
    const logger = createLogger();
    const handler = withApiHandler({ logger, publicIdGenerator }, async () => ({ status: 'ok' }), {
      headers: { 'Cache-Control': 'no-store' },
    });

    const response = await handler(new Request('https://fvdms.lan/api/health'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(requestId);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: 'ok' },
      requestId,
    });
  });

  it('maps typed application errors to their stable public contract', async () => {
    const logger = createLogger();
    const handler = withApiHandler({ logger, publicIdGenerator }, async () => {
      throw new ExternalDependencyError(new Error('connect ECONNREFUSED mysql:3306'));
    });

    const response = await handler(new Request('https://fvdms.lan/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'A required service is unavailable.',
        details: [],
      },
      requestId,
    });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('sanitizes unknown exceptions as an internal error', async () => {
    const logger = createLogger();
    const handler = withApiHandler({ logger, publicIdGenerator }, async () => {
      throw new Error('private stack and SQL details');
    });

    const response = await handler(new Request('https://fvdms.lan/api/failure'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
      details: [],
    });
    expect(JSON.stringify(body)).not.toContain('private stack');
    expect(logger.error).toHaveBeenCalledOnce();
  });
});
