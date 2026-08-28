import { describe, expect, it, vi } from 'vitest';

import { runAuditVerification } from '@/../scripts/audit/verify';

describe('audit verifier command', () => {
  it.each([
    ['PASS', 0],
    ['FAIL', 1],
  ] as const)('maps a %s result to exit code %i', async (status, expectedExitCode) => {
    const write = vi.fn();

    const exitCode = await runAuditVerification(
      {
        execute: vi.fn(async () => ({
          publicId: '019d3aa8-74a1-7000-8000-000000000001',
          status,
          highWaterSequence: '42',
          verifiedCount: status === 'PASS' ? '42' : '17',
          firstMismatchSequence: status === 'PASS' ? null : '18',
          firstMismatchType: status === 'PASS' ? null : ('CHANGED_PAYLOAD' as const),
          summary: status === 'PASS' ? 'Verification passed.' : 'Verification failed.',
          startedAt: '2026-08-28T01:02:03.004Z',
          completedAt: '2026-08-28T01:02:04.004Z',
        })),
      },
      write,
    );

    expect(exitCode).toBe(expectedExitCode);
    expect(write).toHaveBeenCalledWith(expect.stringContaining(`Audit verification ${status}`));
  });
});
