import { describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';

const mocks = vi.hoisted(() => ({ getCurrentChallenge: vi.fn() }));

vi.mock('@/infrastructure/composition/root', () => ({
  createApplicationComposition: () => ({
    getCurrentChallenge: { execute: mocks.getCurrentChallenge },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() },
    publicIdGenerator: {
      generate: () => PublicId.from('019c043f-422c-7141-8a03-a9d9bda3544a'),
    },
  }),
}));

import { GET } from '@/app/api/auth/challenge/route';

describe('GET /api/auth/challenge', () => {
  it('loads the challenge from its opaque cookie and rotates the CSRF token', async () => {
    mocks.getCurrentChallenge.mockResolvedValue({
      type: 'TOTP_VERIFICATION',
      csrfToken: 'rotated-csrf',
    });

    const response = await GET(
      new Request('https://fvdms.lan/api/auth/challenge', {
        headers: { cookie: '__Host-fvdms_challenge=opaque-challenge' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.getCurrentChallenge).toHaveBeenCalledWith('opaque-challenge');
    await expect(response.json()).resolves.toMatchObject({
      data: { type: 'TOTP_VERIFICATION', csrfToken: 'rotated-csrf' },
    });
  });
});
