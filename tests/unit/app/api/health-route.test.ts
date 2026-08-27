import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalDependencyError } from '@/application/shared/errors/application-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  },
}));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    getHealthStatus: { execute: mocks.execute },
    logger: mocks.logger,
    publicIdGenerator: {
      generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a'),
    },
  }),
}));

import { GET } from '@/app/api/health/route';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/health', () => {
  it('returns database readiness without internal connection details', async () => {
    mocks.execute.mockResolvedValue({
      status: 'ok',
      database: 'available',
      timestamp: '2026-08-28T00:00:00.000Z',
    });

    const response = await GET(new Request('https://fvdms.lan/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.data).toEqual({
      status: 'ok',
      database: 'available',
      timestamp: '2026-08-28T00:00:00.000Z',
    });
    expect(JSON.stringify(body)).not.toMatch(/mysql|host|schema|sql|latency/i);
  });

  it('returns a sanitized 503 when the database is unavailable', async () => {
    mocks.execute.mockRejectedValue(
      new ExternalDependencyError(new Error('connect ECONNREFUSED mysql:3306')),
    );

    const response = await GET(new Request('https://fvdms.lan/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });
});
