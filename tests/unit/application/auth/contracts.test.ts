import { describe, expect, it } from 'vitest';

import {
  createCurrentPrincipal,
  type CurrentPrincipal,
} from '@/application/auth/dto/authentication-dtos';
import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';
import type {
  SecurityEvent,
  SecurityEventPort,
} from '@/application/auth/ports/security-event-port';

describe('authentication application contracts', () => {
  it('keeps the current-principal DTO free of persisted and bearer secrets', () => {
    const principal: CurrentPrincipal = createCurrentPrincipal({
      userPublicId: '01900000-0000-7000-8000-000000000001',
      username: 'system.admin',
      fullName: 'System Administrator',
      roles: ['SYSTEM_ADMIN'],
      permissions: ['user.read'],
      isPrivileged: true,
      mustChangePassword: false,
      mfaEnrolled: true,
    });

    expect(principal).toEqual({
      userPublicId: '01900000-0000-7000-8000-000000000001',
      username: 'system.admin',
      fullName: 'System Administrator',
      roles: ['SYSTEM_ADMIN'],
      permissions: ['user.read'],
      isPrivileged: true,
      mustChangePassword: false,
      mfaEnrolled: true,
    });
    expect(
      Object.keys(principal).some((key) =>
        /passwordHash|sessionToken|csrfToken|challengeToken|secret/i.test(key),
      ),
    ).toBe(false);
  });

  it('runs a security workflow through one transaction-scoped repository set', async () => {
    const events: SecurityEvent[] = [];
    const securityEvents: SecurityEventPort = {
      append: async (event) => {
        events.push(event);
      },
    };
    const repositories = { securityEvents } as AuthRepositories;
    const transaction: AuthTransaction = {
      execute: async (work) => work(repositories),
    };
    const event: SecurityEvent = {
      publicId: '01900000-0000-7000-8000-000000000002',
      type: 'auth.session.revoked',
      actorPublicId: null,
      targetPublicId: '01900000-0000-7000-8000-000000000001',
      requestId: '01900000-0000-7000-8000-000000000003',
      reasonCode: 'logout',
      metadata: {},
      occurredAt: new Date('2026-08-28T00:00:00.000Z'),
    };

    await transaction.execute(async ({ securityEvents: eventStore }) => {
      await eventStore.append(event);
    });

    expect(events).toEqual([event]);
  });
});
