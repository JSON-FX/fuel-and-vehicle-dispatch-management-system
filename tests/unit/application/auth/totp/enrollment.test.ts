import { describe, expect, it } from 'vitest';

import { ConfirmTotpEnrollment } from '@/application/auth/use-cases/confirm-totp-enrollment';
import { StartTotpEnrollment } from '@/application/auth/use-cases/start-totp-enrollment';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
} from '../support/auth-fakes';

const now = new Date('2026-08-28T00:00:00.000Z');

describe('privileged TOTP enrollment', () => {
  it('stores only an encrypted pending secret and returns the QR plus fallback once', async () => {
    const saved: unknown[] = [];
    const useCase = new StartTotpEnrollment({
      transaction: new FakeAuthTransaction(
        authRepositories({
          totpFactors: { save: async (factor: unknown) => saved.push(factor) } as never,
        }),
      ),
      totp: {
        generateSecret: () => 'BASE32SECRET',
        createEnrollmentUri: () => 'otpauth://totp/FVDMS:user',
      } as never,
      encryptor: {
        encrypt: () => ({
          ciphertext: new Uint8Array([1]),
          iv: new Uint8Array(12),
          authenticationTag: new Uint8Array(16),
          keyVersion: 1,
        }),
      } as never,
      qrCode: { toSvg: async () => '<svg />' },
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => now },
      issuer: 'FVDMS',
    });

    const result = await useCase.execute({
      userPublicId: '01900000-0000-7000-8000-000000000100',
      username: 'system.admin',
    });

    expect(result).toMatchObject({ manualSecret: 'BASE32SECRET', qrSvg: '<svg />' });
    expect(saved).toEqual([
      expect.objectContaining({
        status: 'PENDING',
        encryptedSecret: expect.objectContaining({ ciphertext: new Uint8Array([1]) }),
      }),
    ]);
    expect(JSON.stringify(saved)).not.toContain('BASE32SECRET');
  });

  it('enables a pending factor only after a valid code', async () => {
    const enabled: number[] = [];
    const useCase = new ConfirmTotpEnrollment({
      transaction: new FakeAuthTransaction(
        authRepositories({
          totpFactors: {
            findForUser: async () => ({
              publicId: '01900000-0000-7000-8000-000000000101',
              userPublicId: '01900000-0000-7000-8000-000000000100',
              status: 'PENDING',
              encryptedSecret: {
                ciphertext: new Uint8Array([1]),
                iv: new Uint8Array(12),
                authenticationTag: new Uint8Array(16),
                keyVersion: 1,
              },
              lastUsedCounter: null,
              confirmedAt: null,
              createdAt: now,
              updatedAt: now,
            }),
            enable: async (_id: string, _at: Date, counter: number) => {
              enabled.push(counter);
              return true;
            },
          } as never,
          users: {
            findByPublicId: async () => ({
              publicId: '01900000-0000-7000-8000-000000000100',
              username: 'system.admin',
              email: 'admin@example.lan',
              fullName: 'System Administrator',
              passwordHash: 'hash',
              isActive: true,
              mustChangePassword: false,
              deletedAt: null,
              roles: ['SYSTEM_ADMIN'],
              permissions: [],
              isPrivileged: true,
              mfaEnrolled: false,
            }),
          } as never,
          challenges: { consume: async () => true } as never,
          rateLimits: {
            find: async () => null,
            clear: async () => undefined,
          } as never,
          sessions: {
            countActivePrivileged: async () => 0,
            create: async () => undefined,
          } as never,
          securityEvents: { append: async () => undefined },
        }),
      ),
      totp: { verify: () => 1_000 } as never,
      encryptor: { decrypt: () => 'BASE32SECRET' } as never,
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => now },
      tokenGenerator: {
        generateToken: () => 'token',
        hashToken: () => new Uint8Array([1]),
      } as never,
      rateLimitKeys: { forTotp: () => new Uint8Array(32) } as never,
      sessionPolicy: {
        standardIdleTimeoutSeconds: 1_800,
        privilegedIdleTimeoutSeconds: 900,
        absoluteTimeoutSeconds: 28_800,
        privilegedSessionLimit: 1,
      },
      rateLimitPolicy: { windowSeconds: 900, lockSeconds: 900, maximumFailures: 5 },
    });

    await useCase.execute({
      userPublicId: '01900000-0000-7000-8000-000000000100',
      challengePublicId: '01900000-0000-7000-8000-000000000102',
      code: '123456',
      requestId: 'request-id',
    });

    expect(enabled).toEqual([1_000]);
  });
});
