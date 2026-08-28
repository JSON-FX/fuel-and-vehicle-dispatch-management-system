import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DispatchApiError,
  getFreshDispatchCsrfToken,
  readDispatchApiResponse,
} from '@/lib/dispatch/dispatch-form-response';

describe('dispatch form response', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns successful data', async () => {
    await expect(
      readDispatchApiResponse<{ publicId: string }>(
        Response.json({ success: true, data: { publicId: 'dispatch-1' } }),
      ),
    ).resolves.toEqual({ publicId: 'dispatch-1' });
  });

  it('maps field errors for inline display and first-invalid-field focus', async () => {
    const error = await readDispatchApiResponse(
      Response.json(
        {
          success: false,
          error: {
            message: 'Review the dispatch details.',
            details: [
              { field: 'odoAfter', reason: 'Use a value at least equal to the initial reading.' },
              { reason: 'General conflict.' },
            ],
          },
        },
        { status: 400 },
      ),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(DispatchApiError);
    expect(error).toMatchObject({
      message: 'Review the dispatch details.',
      fieldErrors: { odoAfter: 'Use a value at least equal to the initial reading.' },
    });
  });

  it('uses a safe generic message for malformed failure envelopes', async () => {
    await expect(
      readDispatchApiResponse(Response.json({ success: false }, { status: 500 })),
    ).rejects.toThrow('The request could not be completed.');
  });

  it('rotates and returns fresh CSRF material before a lifecycle mutation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ success: true, data: { csrfToken: 'fresh-csrf-token' } }));
    vi.stubGlobal('fetch', fetch);

    await expect(getFreshDispatchCsrfToken()).resolves.toBe('fresh-csrf-token');
    expect(fetch).toHaveBeenCalledWith('/api/me', { cache: 'no-store' });
  });
});
