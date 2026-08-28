import { describe, expect, it, vi } from 'vitest';

import { CompleteTotpChallenge } from '@/application/auth/use-cases/complete-totp-challenge';

import { authRepositories, FakeAuthTransaction } from '../support/auth-fakes';

describe('CompleteTotpChallenge', () => {
  it('rejects a replay when the accepted counter cannot advance atomically', async () => {
    const useCase = new CompleteTotpChallenge({
      transaction: new FakeAuthTransaction(
        authRepositories({
          totpFactors: {
            findForUser: async () => ({
              publicId: '01900000-0000-7000-8000-000000000101',
              status: 'ENABLED',
              encryptedSecret: {},
            }),
            acceptCounter: async () => false,
          } as never,
          rateLimits: { find: async () => null } as never,
        }),
      ),
      totp: { verify: () => 1_000 } as never,
      encryptor: { decrypt: () => 'BASE32SECRET' } as never,
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
      rateLimitKeys: { forTotp: () => new Uint8Array(32) } as never,
    } as never);

    await expect(
      useCase.execute({
        userPublicId: '01900000-0000-7000-8000-000000000100',
        challengePublicId: '01900000-0000-7000-8000-000000000102',
        code: '123456',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 401 });
  });

  it('rejects a currently locked TOTP challenge before verifying a code', async () => {
    const verify = vi.fn();
    const useCase = new CompleteTotpChallenge({
      transaction: new FakeAuthTransaction(
        authRepositories({
          rateLimits: {
            find: async () => ({ lockedUntil: new Date('2026-08-28T00:15:00.000Z') }),
          } as never,
        }),
      ),
      totp: { verify } as never,
      rateLimitKeys: { forTotp: () => new Uint8Array(32) } as never,
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
    } as never);

    await expect(
      useCase.execute({
        userPublicId: '01900000-0000-7000-8000-000000000100',
        challengePublicId: '01900000-0000-7000-8000-000000000102',
        code: '123456',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: 429 });
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    { lockedUntil: null, status: 401 },
    { lockedUntil: new Date('2026-08-28T00:15:00.000Z'), status: 429 },
  ])('durably counts an invalid code and returns $status', async ({ lockedUntil, status }) => {
    const incrementFailure = vi.fn().mockResolvedValue(1);
    const recordFailure = vi.fn().mockResolvedValue({ lockedUntil });
    const useCase = new CompleteTotpChallenge({
      transaction: new FakeAuthTransaction(
        authRepositories({
          rateLimits: { find: async () => null, recordFailure } as never,
          challenges: { incrementFailure } as never,
          totpFactors: {
            findForUser: async () => ({
              publicId: '01900000-0000-7000-8000-000000000101',
              status: 'ENABLED',
              encryptedSecret: {},
            }),
          } as never,
        }),
      ),
      totp: { verify: () => null } as never,
      encryptor: { decrypt: () => 'BASE32SECRET' } as never,
      rateLimitKeys: { forTotp: () => new Uint8Array(32).fill(7) } as never,
      clock: { now: () => new Date('2026-08-28T00:00:00.000Z') },
      policy: {
        rateLimitWindowSeconds: 900,
        rateLimitLockSeconds: 900,
        rateLimitMaxFailures: 5,
      },
    } as never);

    await expect(
      useCase.execute({
        userPublicId: '01900000-0000-7000-8000-000000000100',
        challengePublicId: '01900000-0000-7000-8000-000000000102',
        code: '000000',
        requestId: 'request-id',
      }),
    ).rejects.toMatchObject({ httpStatus: status });
    expect(incrementFailure).toHaveBeenCalledOnce();
    expect(recordFailure).toHaveBeenCalledWith(
      expect.objectContaining({ bucketType: 'TOTP', maximumFailures: 5 }),
    );
  });
});
