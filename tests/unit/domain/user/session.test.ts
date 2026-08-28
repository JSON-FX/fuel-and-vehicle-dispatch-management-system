import { describe, expect, it } from 'vitest';

import { PublicId } from '@/domain/shared/value-objects/public-id';
import { Session } from '@/domain/user/entities/session';

describe('Session', () => {
  const createSession = () =>
    new Session({
      publicId: PublicId.from('01900000-0000-7000-8000-000000000010'),
      createdAt: new Date('2026-08-28T00:00:00.000Z'),
      lastSeenAt: new Date('2026-08-28T00:05:00.000Z'),
      idleExpiresAt: new Date('2026-08-28T00:35:00.000Z'),
      absoluteExpiresAt: new Date('2026-08-28T08:00:00.000Z'),
      revokedAt: null,
      revokeReason: null,
      isPrivileged: false,
    });

  it('distinguishes active, idle-expired, absolute-expired, and revoked sessions', () => {
    expect(createSession().statusAt(new Date('2026-08-28T00:30:00.000Z'))).toBe('ACTIVE');
    expect(createSession().statusAt(new Date('2026-08-28T00:35:00.000Z'))).toBe('IDLE_EXPIRED');
    expect(createSession().statusAt(new Date('2026-08-28T08:00:00.000Z'))).toBe('ABSOLUTE_EXPIRED');

    const revoked = createSession();
    revoked.revoke(new Date('2026-08-28T00:10:00.000Z'), 'logout');
    expect(revoked.statusAt(new Date('2026-08-28T00:11:00.000Z'))).toBe('REVOKED');
  });

  it('writes activity only after the configured interval without extending absolute life', () => {
    const session = createSession();

    expect(session.needsActivityUpdate(new Date('2026-08-28T00:09:59.000Z'), 300)).toBe(false);
    expect(session.needsActivityUpdate(new Date('2026-08-28T00:10:00.000Z'), 300)).toBe(true);

    session.recordActivity(new Date('2026-08-28T07:50:00.000Z'), 1_800);
    expect(session.idleExpiresAt.toISOString()).toBe('2026-08-28T08:00:00.000Z');
  });
});
