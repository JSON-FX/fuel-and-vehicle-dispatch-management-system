import { describe, expect, it, vi } from 'vitest';

import { AuthenticateChallenge } from '@/application/auth/services/authenticate-challenge';
import { GetCurrentChallenge } from '@/application/auth/use-cases/get-current-challenge';
import { GetCurrentPrincipal } from '@/application/auth/use-cases/get-current-principal';

import { authRepositories, FakeAuthTransaction } from './support/auth-fakes';

const now = new Date('2026-08-28T00:00:00.000Z');
const user = {
  publicId: 'user-public-id',
  username: 'administrator',
  isActive: true,
  deletedAt: null,
};
const challenge = {
  publicId: 'challenge-public-id',
  userPublicId: user.publicId,
  csrfTokenHash: new Uint8Array(32).fill(1),
  type: 'TOTP_VERIFICATION',
  consumedAt: null,
  expiresAt: new Date('2026-08-28T00:05:00.000Z'),
};

function authenticateChallenge(
  overrides: {
    bearerToken?: string;
    foundChallenge?: unknown;
    foundUser?: unknown;
  } = {},
) {
  const hashToken = vi.fn().mockReturnValue(new Uint8Array(32).fill(7));
  const service = new AuthenticateChallenge({
    transaction: new FakeAuthTransaction(
      authRepositories({
        challenges: {
          findByTokenHash: vi
            .fn()
            .mockResolvedValue(
              overrides.foundChallenge === undefined ? challenge : overrides.foundChallenge,
            ),
        } as never,
        users: {
          findByPublicId: vi
            .fn()
            .mockResolvedValue(overrides.foundUser === undefined ? user : overrides.foundUser),
        } as never,
      }),
    ),
    tokenGenerator: { hashToken } as never,
    clock: { now: () => now },
  });
  return { service, hashToken, bearerToken: overrides.bearerToken ?? 'bearer-token' };
}

describe('AuthenticateChallenge', () => {
  it('authenticates an active, unconsumed challenge by token hash', async () => {
    const { service, hashToken } = authenticateChallenge();

    await expect(service.execute('bearer-token')).resolves.toEqual({
      challengePublicId: challenge.publicId,
      userPublicId: user.publicId,
      username: user.username,
      csrfTokenHash: challenge.csrfTokenHash,
      type: 'TOTP_VERIFICATION',
    });
    expect(hashToken).toHaveBeenCalledWith('bearer-token');
  });

  it('rejects missing and unknown challenge tokens', async () => {
    const { service } = authenticateChallenge({ foundChallenge: null });
    expect(() => service.execute('')).toThrowError(expect.objectContaining({ httpStatus: 401 }));
    await expect(service.execute('unknown')).rejects.toMatchObject({ httpStatus: 401 });
  });

  it.each([
    { consumedAt: now, expiresAt: challenge.expiresAt },
    { consumedAt: null, expiresAt: now },
    { consumedAt: null, expiresAt: new Date('2026-08-27T23:59:59.000Z') },
  ])('rejects an expired or consumed challenge: %o', async (state) => {
    const { service } = authenticateChallenge({ foundChallenge: { ...challenge, ...state } });
    await expect(service.execute('bearer-token')).rejects.toMatchObject({ httpStatus: 401 });
  });

  it.each([null, { ...user, isActive: false }, { ...user, deletedAt: now }])(
    'rejects an unavailable challenge user: %o',
    async (foundUser) => {
      const { service } = authenticateChallenge({ foundUser });
      await expect(service.execute('bearer-token')).rejects.toMatchObject({ httpStatus: 401 });
    },
  );
});

describe('current browser authentication', () => {
  it('rotates challenge CSRF material and returns the plaintext once', async () => {
    const replaceCsrfTokenHash = vi.fn().mockResolvedValue(true);
    const tokenGenerator = {
      generateToken: vi.fn().mockReturnValue('new-csrf-token'),
      hashToken: vi.fn().mockReturnValue(new Uint8Array(32).fill(9)),
    };
    const useCase = new GetCurrentChallenge({
      authenticateChallenge: {
        execute: vi.fn().mockResolvedValue({
          challengePublicId: challenge.publicId,
          type: challenge.type,
        }),
      } as never,
      transaction: new FakeAuthTransaction(
        authRepositories({ challenges: { replaceCsrfTokenHash } as never }),
      ),
      tokenGenerator: tokenGenerator as never,
    });

    await expect(useCase.execute('bearer-token')).resolves.toEqual({
      type: 'TOTP_VERIFICATION',
      csrfToken: 'new-csrf-token',
    });
    expect(replaceCsrfTokenHash).toHaveBeenCalledWith(challenge.publicId, expect.any(Uint8Array));
  });

  it('rejects a failed challenge CSRF rotation', async () => {
    const useCase = new GetCurrentChallenge({
      authenticateChallenge: {
        execute: vi.fn().mockResolvedValue({ challengePublicId: challenge.publicId }),
      } as never,
      transaction: new FakeAuthTransaction(
        authRepositories({
          challenges: { replaceCsrfTokenHash: vi.fn().mockResolvedValue(false) } as never,
        }),
      ),
      tokenGenerator: {
        generateToken: () => 'csrf',
        hashToken: () => new Uint8Array(32),
      } as never,
    });
    await expect(useCase.execute('bearer-token')).rejects.toMatchObject({ httpStatus: 401 });
  });

  it('rotates session CSRF material and returns the current principal', async () => {
    const principal = { userPublicId: user.publicId, permissions: [] };
    const replaceCsrfTokenHash = vi.fn().mockResolvedValue(true);
    const useCase = new GetCurrentPrincipal({
      authenticateSession: {
        execute: vi.fn().mockResolvedValue({ sessionPublicId: 'session-public-id', principal }),
      } as never,
      transaction: new FakeAuthTransaction(
        authRepositories({ sessions: { replaceCsrfTokenHash } as never }),
      ),
      tokenGenerator: {
        generateToken: () => 'session-csrf',
        hashToken: () => new Uint8Array(32).fill(4),
      } as never,
    });

    await expect(useCase.execute('bearer-token')).resolves.toEqual({
      principal,
      csrfToken: 'session-csrf',
    });
    expect(replaceCsrfTokenHash).toHaveBeenCalledWith('session-public-id', expect.any(Uint8Array));
  });

  it('rejects a failed session CSRF rotation', async () => {
    const useCase = new GetCurrentPrincipal({
      authenticateSession: {
        execute: vi.fn().mockResolvedValue({ sessionPublicId: 'session-public-id' }),
      } as never,
      transaction: new FakeAuthTransaction(
        authRepositories({
          sessions: { replaceCsrfTokenHash: vi.fn().mockResolvedValue(false) } as never,
        }),
      ),
      tokenGenerator: {
        generateToken: () => 'csrf',
        hashToken: () => new Uint8Array(32),
      } as never,
    });
    await expect(useCase.execute('bearer-token')).rejects.toMatchObject({ httpStatus: 401 });
  });
});
