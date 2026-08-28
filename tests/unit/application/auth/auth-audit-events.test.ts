import { describe, expect, it } from 'vitest';

import { buildAuthenticationAuditEvent } from '@/application/auth/services/auth-audit-events';

describe('authentication audit event builders', () => {
  it('maps user evidence into the shared version-one contract', () => {
    expect(
      buildAuthenticationAuditEvent({
        publicId: '01900000-0000-7000-8000-000000000701',
        action: 'auth.user.updated',
        actorPublicId: '01900000-0000-7000-8000-000000000702',
        targetPublicId: '01900000-0000-7000-8000-000000000703',
        requestId: 'request-701',
        reasonCode: 'profile_changed',
        metadata: { changedFields: 2 },
        occurredAt: new Date('2026-08-28T04:00:00.000Z'),
      }),
    ).toEqual({
      publicId: '01900000-0000-7000-8000-000000000701',
      schemaVersion: 1,
      occurredAt: '2026-08-28T04:00:00.000Z',
      actorPublicId: '01900000-0000-7000-8000-000000000702',
      action: 'auth.user.updated',
      entity: { type: 'user', publicId: '01900000-0000-7000-8000-000000000703' },
      requestId: 'request-701',
      ipAddress: null,
      userAgent: null,
      reasonCode: 'profile_changed',
      before: null,
      after: null,
      metadata: { changedFields: 2 },
    });
  });

  it('uses the allowlisted role public ID as the role entity', () => {
    const event = buildAuthenticationAuditEvent({
      publicId: '01900000-0000-7000-8000-000000000704',
      action: 'auth.role.permissions.changed',
      actorPublicId: '01900000-0000-7000-8000-000000000702',
      targetPublicId: null,
      requestId: 'request-704',
      reasonCode: null,
      metadata: { rolePublicId: '01900000-0000-7000-8000-000000000705', permissionCount: 3 },
      occurredAt: new Date('2026-08-28T04:00:00.000Z'),
    });

    expect(event.entity).toEqual({
      type: 'role',
      publicId: '01900000-0000-7000-8000-000000000705',
    });
  });

  it('rejects secrets instead of serializing arbitrary context', () => {
    expect(() =>
      buildAuthenticationAuditEvent({
        publicId: '01900000-0000-7000-8000-000000000706',
        action: 'auth.login.failed',
        actorPublicId: null,
        targetPublicId: null,
        requestId: 'request-706',
        reasonCode: 'invalid_credentials',
        metadata: { password: 'not-allowed' } as never,
        occurredAt: new Date('2026-08-28T04:00:00.000Z'),
      }),
    ).toThrowError(/sensitive/i);
  });
});
