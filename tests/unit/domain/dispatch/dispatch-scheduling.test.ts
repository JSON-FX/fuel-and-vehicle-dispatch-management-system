import { describe, expect, it } from 'vitest';

import { reservesDispatchDay } from '@/domain/dispatch/policies/dispatch-reservation-policy';
import { DispatchConflictPolicy } from '@/domain/dispatch/value-objects/dispatch-conflict-policy';
import { DispatchConflictType } from '@/domain/dispatch/value-objects/dispatch-conflict-type';
import { DispatchOverrideReason } from '@/domain/dispatch/value-objects/dispatch-override-reason';
import { DomainError } from '@/domain/shared/errors/domain-error';

describe('dispatch scheduling domain', () => {
  it.each(['BLOCK', 'WARN_AND_ACK'] as const)('accepts conflict policy %s', (value) => {
    expect(DispatchConflictPolicy.from(value).toString()).toBe(value);
  });

  it.each(['', 'WARN', null])('rejects conflict policy %j', (value) => {
    expect(() => DispatchConflictPolicy.from(value)).toThrow(DomainError);
  });

  it.each(['DRIVER', 'VEHICLE', 'DRIVER_AND_VEHICLE'] as const)(
    'accepts conflict type %s',
    (value) => {
      expect(DispatchConflictType.from(value).toString()).toBe(value);
    },
  );

  it('normalizes an override reason without changing its evidence', () => {
    expect(
      DispatchOverrideReason.from(
        '  Reviewed   both schedules and approved the second trip.  ',
      ).toString(),
    ).toBe('Reviewed both schedules and approved the second trip.');
  });

  it.each(['short', 'x'.repeat(501), 'Reviewed\nwith an unsafe control character.'])(
    'rejects invalid override reason %j',
    (value) => {
      expect(() => DispatchOverrideReason.from(value)).toThrow(DomainError);
    },
  );

  it.each([
    ['DRAFT', true],
    ['DISPATCHED', true],
    ['COMPLETED', true],
    ['CANCELLED', false],
  ] as const)('treats %s reservation status as %s', (status, expected) => {
    expect(reservesDispatchDay(status)).toBe(expected);
  });
});
