import { describe, expect, it } from 'vitest';

import { BudgetApiError, readBudgetApiResponse } from '@/lib/budget/budget-form-response';

describe('budget form responses', () => {
  it('returns successful data and preserves safe field details on errors', async () => {
    await expect(
      readBudgetApiResponse(Response.json({ success: true, data: { publicId: 'allocation-1' } })),
    ).resolves.toEqual({ publicId: 'allocation-1' });

    const error = await readBudgetApiResponse(
      Response.json(
        {
          success: false,
          error: {
            message: 'The request conflicts with another allocation.',
            details: [{ field: 'ppmpNumber', reason: 'This identity is already in use.' }],
          },
        },
        { status: 409 },
      ),
    ).catch((caught) => caught);
    expect(error).toBeInstanceOf(BudgetApiError);
    expect(error).toMatchObject({
      fieldErrors: { ppmpNumber: 'This identity is already in use.' },
    });
  });
});
