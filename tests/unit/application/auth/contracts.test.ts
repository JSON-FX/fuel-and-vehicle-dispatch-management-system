import { describe, expect, it } from 'vitest';

import {
  createCurrentPrincipal,
  type CurrentPrincipal,
} from '@/application/auth/dto/authentication-dtos';
import type { AuditEventInput } from '@/application/audit/dto/audit-event-dtos';
import type { AuditEventPort } from '@/application/audit/ports/audit-event-port';
import type { AuthRepositories, AuthTransaction } from '@/application/auth/ports/auth-transaction';

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
    const events: AuditEventInput[] = [];
    const auditEvents: AuditEventPort = {
      append: async (event) => {
        if ('action' in event) events.push(event);
      },
    };
    const repositories = { auditEvents } as AuthRepositories;
    const transaction: AuthTransaction = {
      execute: async (work) => work(repositories),
    };
    const event: AuditEventInput = {
      publicId: '01900000-0000-7000-8000-000000000002',
      schemaVersion: 1,
      occurredAt: '2026-08-28T00:00:00.000Z',
      actorPublicId: null,
      action: 'auth.session.revoked',
      entity: { type: 'user', publicId: '01900000-0000-7000-8000-000000000001' },
      requestId: '01900000-0000-7000-8000-000000000003',
      ipAddress: null,
      userAgent: null,
      reasonCode: 'logout',
      before: null,
      after: null,
      metadata: {},
    };

    await transaction.execute(async ({ auditEvents: eventStore }) => {
      await eventStore.append(event);
    });

    expect(events).toEqual([event]);
  });
});
