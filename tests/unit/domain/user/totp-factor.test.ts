import { describe, expect, it } from 'vitest';

import { DomainError } from '@/domain/shared/errors/domain-error';
import { PublicId } from '@/domain/shared/value-objects/public-id';
import { TotpFactor } from '@/domain/user/entities/totp-factor';

describe('TotpFactor', () => {
  it('moves from pending to enabled and rejects replayed counters', () => {
    const factor = new TotpFactor({
      publicId: PublicId.from('01900000-0000-7000-8000-000000000020'),
      status: 'PENDING',
      confirmedAt: null,
      lastUsedCounter: null,
    });

    factor.enable(new Date('2026-08-28T00:00:00.000Z'));
    factor.acceptCounter(1_000);

    expect(factor.status).toBe('ENABLED');
    expect(factor.lastUsedCounter).toBe(1_000);
    expect(() => factor.acceptCounter(1_000)).toThrow(DomainError);
    expect(() => factor.acceptCounter(999)).toThrow(DomainError);
  });
});
