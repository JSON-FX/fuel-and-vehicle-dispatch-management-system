import { describe, expect, it } from 'vitest';

import { FuelApiError, readFuelApiResponse } from '@/lib/fuel/fuel-form-response';

describe('fuel form response', () => {
  it('returns successful data', async () => {
    await expect(
      readFuelApiResponse<{ publicId: string }>(
        Response.json({ success: true, data: { publicId: 'fuel-1' } }),
      ),
    ).resolves.toEqual({ publicId: 'fuel-1' });
  });

  it('maps field errors and preserves the safe message', async () => {
    const error = await readFuelApiResponse(
      Response.json(
        {
          success: false,
          error: {
            message: 'Review the fuel quantity.',
            details: [
              { field: 'issuedLiters', reason: 'Use a positive quantity.' },
              { reason: 'General conflict.' },
            ],
          },
        },
        { status: 400 },
      ),
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FuelApiError);
    expect(error).toMatchObject({
      message: 'Review the fuel quantity.',
      fieldErrors: { issuedLiters: 'Use a positive quantity.' },
    });
  });

  it('uses a generic message for malformed failure envelopes', async () => {
    await expect(
      readFuelApiResponse(Response.json({ success: false }, { status: 500 })),
    ).rejects.toThrow('The request could not be completed.');
  });
});
