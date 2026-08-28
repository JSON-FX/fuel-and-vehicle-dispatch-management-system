import { describe, expect, it } from 'vitest';

import {
  MasterDataApiError,
  readMasterDataApiResponse,
} from '@/lib/master-data/master-data-form-response';

describe('master-data form responses', () => {
  it('returns successful data', async () => {
    const response = Response.json({ success: true, data: { publicId: 'office-1' } });
    await expect(readMasterDataApiResponse(response)).resolves.toEqual({ publicId: 'office-1' });
  });

  it('maps safe API details to form fields', async () => {
    const response = Response.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A unique master-data value already exists.',
          details: [{ field: 'abbreviation', reason: 'This value is already in use.' }],
        },
      },
      { status: 409 },
    );
    const error = await readMasterDataApiResponse(response).catch((caught) => caught);
    expect(error).toBeInstanceOf(MasterDataApiError);
    expect(error).toMatchObject({
      fieldErrors: { abbreviation: 'This value is already in use.' },
    });
  });
});
