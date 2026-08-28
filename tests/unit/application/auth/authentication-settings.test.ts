import { describe, expect, it, vi } from 'vitest';

import { GetAuthenticationSettings } from '@/application/auth/use-cases/get-authentication-settings';
import { UpdateAuthenticationSettings } from '@/application/auth/use-cases/update-authentication-settings';

import {
  authRepositories,
  FakeAuthTransaction,
  SequencePublicIdGenerator,
  TEST_ACTOR_PUBLIC_ID,
} from './support/auth-fakes';

const now = new Date('2026-08-28T12:00:00.000Z');
const actor = (permissions: readonly string[]) =>
  ({ userPublicId: TEST_ACTOR_PUBLIC_ID, permissions }) as never;
const disabledSettings = {
  mfaRequired: false,
  updatedAt: new Date('2026-08-28T00:00:00.000Z'),
  updatedByUserPublicId: null,
};

describe('authentication settings administration', () => {
  it('returns the global setting to an authorized administrator', async () => {
    const useCase = new GetAuthenticationSettings({
      get: vi.fn().mockResolvedValue(disabledSettings),
    });

    await expect(useCase.execute(actor(['auth.settings.manage']))).resolves.toEqual(
      disabledSettings,
    );
  });

  it('enables MFA, revokes privileged sessions, and records immutable evidence', async () => {
    const update = vi.fn().mockResolvedValue({
      mfaRequired: true,
      updatedAt: now,
      updatedByUserPublicId: TEST_ACTOR_PUBLIC_ID,
    });
    const revokeAllPrivileged = vi.fn().mockResolvedValue(3);
    const append = vi.fn().mockResolvedValue(undefined);
    const useCase = new UpdateAuthenticationSettings({
      transaction: new FakeAuthTransaction(
        authRepositories({
          authenticationSettings: { get: vi.fn().mockResolvedValue(disabledSettings), update },
          sessions: { revokeAllPrivileged } as never,
          auditEvents: { append } as never,
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => now },
    });

    const result = await useCase.execute({
      actor: actor(['auth.settings.manage']),
      mfaRequired: true,
      requestId: 'request-id',
    });

    expect(update).toHaveBeenCalledWith({
      mfaRequired: true,
      updatedAt: now,
      updatedByUserPublicId: TEST_ACTOR_PUBLIC_ID,
    });
    expect(revokeAllPrivileged).toHaveBeenCalledWith(now, 'mfa_requirement_enabled');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.mfa.requirement.changed',
        metadata: { previous: false, next: true, revokedSessionCount: 3 },
      }),
    );
    expect(result).toEqual({
      settings: {
        mfaRequired: true,
        updatedAt: now,
        updatedByUserPublicId: TEST_ACTOR_PUBLIC_ID,
      },
      reauthenticationRequired: true,
      revokedSessionCount: 3,
    });
  });

  it('does not write or revoke sessions when the requested value is unchanged', async () => {
    const update = vi.fn();
    const revokeAllPrivileged = vi.fn();
    const append = vi.fn();
    const useCase = new UpdateAuthenticationSettings({
      transaction: new FakeAuthTransaction(
        authRepositories({
          authenticationSettings: {
            get: vi.fn().mockResolvedValue(disabledSettings),
            update,
          },
          sessions: { revokeAllPrivileged } as never,
          auditEvents: { append } as never,
        }),
      ),
      publicIds: new SequencePublicIdGenerator(),
      clock: { now: () => now },
    });

    await expect(
      useCase.execute({
        actor: actor(['auth.settings.manage']),
        mfaRequired: false,
        requestId: 'request-id',
      }),
    ).resolves.toEqual({
      settings: disabledSettings,
      reauthenticationRequired: false,
      revokedSessionCount: 0,
    });
    expect(update).not.toHaveBeenCalled();
    expect(revokeAllPrivileged).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('denies reads and updates without the settings permission', async () => {
    expect(() => new GetAuthenticationSettings({} as never).execute(actor([]))).toThrowError(
      expect.objectContaining({ httpStatus: 403 }),
    );
    expect(() =>
      new UpdateAuthenticationSettings({} as never).execute({
        actor: actor([]),
        mfaRequired: true,
        requestId: 'request-id',
      }),
    ).toThrowError(expect.objectContaining({ httpStatus: 403 }));
  });
});
