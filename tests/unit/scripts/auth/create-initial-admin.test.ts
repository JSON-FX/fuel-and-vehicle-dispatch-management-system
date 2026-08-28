import { describe, expect, it, vi } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import {
  parseInitialAdminArguments,
  runCreateInitialAdmin,
} from '@/../scripts/auth/create-initial-admin';

describe('create-initial-admin command', () => {
  it('accepts identity arguments without accepting a password', () => {
    expect(
      parseInitialAdminArguments([
        '--full-name',
        'System Administrator',
        '--username',
        ' System.Admin ',
        '--email',
        'admin@example.lan',
      ]),
    ).toEqual({
      fullName: 'System Administrator',
      username: ' System.Admin ',
      email: 'admin@example.lan',
    });

    expect(() => parseInitialAdminArguments(['--password', 'unsafe-default'])).toThrow(/Usage/);
  });

  it('prints the returned temporary credential exactly once', async () => {
    const write = vi.fn();
    const execute = vi.fn().mockResolvedValue({
      username: 'system.admin',
      targetPublicId: '01900000-0000-7000-8000-000000000100',
      temporaryPassword: 'one-time-password',
    });

    await runCreateInitialAdmin(
      [
        '--full-name',
        'System Administrator',
        '--username',
        'system.admin',
        '--email',
        'admin@example.lan',
      ],
      {
        useCase: { execute },
        publicIds: { generate: () => PublicId.from('01900000-0000-7000-8000-000000000101') },
        write,
      },
    );

    expect(
      write.mock.calls.flat().filter((line) => String(line).includes('one-time-password')),
    ).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: '01900000-0000-7000-8000-000000000101' }),
    );
  });
});
