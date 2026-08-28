import { describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({ getCurrentPrincipal: vi.fn() }));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    getCurrentPrincipal: { execute: mocks.getCurrentPrincipal },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a'),
    },
  }),
}));

import { GET } from '@/app/api/me/route';

describe('GET /api/me', () => {
  it('returns the current principal and a rotated CSRF token', async () => {
    mocks.getCurrentPrincipal.mockResolvedValue({
      principal: { username: 'dispatcher', permissions: ['dispatch.read'] },
      csrfToken: 'rotated-csrf',
    });
    const response = await GET(
      new Request('https://fvdms.lan/api/me', {
        headers: { cookie: '__Host-fvdms_session=opaque-session' },
      }),
    );

    expect(mocks.getCurrentPrincipal).toHaveBeenCalledWith('opaque-session');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      data: { principal: { username: 'dispatcher' }, csrfToken: 'rotated-csrf' },
    });
  });
});
